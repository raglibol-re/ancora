import { Address, rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";
import type { Network } from "./readContract.ts";

// What actually happened to the organization's money, read from the ledger's events rather than
// from what this app triggered: token transfers in and out of the organization (deposits,
// payments, Reserve moves) and test money minted to it. Soroban RPC keeps about a week of events
// and scans at most ten thousand ledgers per request, so the week is read in chunks: the newest
// ones while the organization loads, the rest afterwards (`backfillTransfers`). The page read
// before is passed back in, so a later visit scans only the ledgers since.

export type ChainTransfer = {
	id: string;
	txHash: string;
	/** Ledger close time, ms. */
	at: number;
	token: string;
	/** The token contract itself when the amount was issued (minted) to the organization. */
	from: string;
	to: string;
	/** Token minor units (stroops for 7-decimal tokens). */
	amount: bigint;
};

export type HistoryPage = {
	/** The ledger range read without gaps; transfers found before it are kept as well. */
	fromLedger: number;
	toLedger: number;
	/** Oldest first. */
	transfers: ChainTransfer[];
};

const DAY_IN_LEDGERS = 17_280;
const LOOKBACK_LEDGERS = 7 * DAY_IN_LEDGERS;
/** Below what RPC scans before cutting a request off, so one chunk is normally one request. */
const CHUNK_LEDGERS = 8_000;
/** Chunks read while the organization loads: about the last eleven hours. */
const INLINE_CHUNKS = 1;
const PARALLEL_CHUNKS = 4;
const PAGE = 500;
/** Entries kept per organization; older ones stay on the explorer. */
const KEEP = 400;

/**
 * Transfers of `tokens` into or out of `organization` since `known` (the page read last time),
 * limited to the newest chunks so the organization shows up quickly; `backfillTransfers` reads
 * the rest. A chunk that fails fails the read.
 */
export async function readTransfers(
	network: Network,
	organization: string,
	tokens: readonly string[],
	known: HistoryPage | null,
): Promise<HistoryPage> {
	const server = new rpc.Server(network.rpcUrl);
	const health = await server.getHealth();
	const latest = health.latestLedger;
	const windowStart = Math.max(health.oldestLedger, latest - LOOKBACK_LEDGERS);
	const wanted = known ? Math.max(windowStart, known.toLedger + 1) : windowStart;
	if (known && wanted > latest) return known;
	const start = Math.max(wanted, latest + 1 - INLINE_CHUNKS * CHUNK_LEDGERS);
	const found = await scan(server, organization, tokens, start, latest + 1);
	// Contiguous with the known range only when nothing was skipped in between.
	const fromLedger = known && start === wanted ? known.fromLedger : start;
	return merge({ fromLedger, toLedger: latest, transfers: found }, known);
}

/**
 * The part of RPC's week older than `known.fromLedger`, merged in; `null` when the known range
 * already reaches the start of the week.
 */
export async function backfillTransfers(
	network: Network,
	organization: string,
	tokens: readonly string[],
	known: HistoryPage,
): Promise<HistoryPage | null> {
	const server = new rpc.Server(network.rpcUrl);
	const health = await server.getHealth();
	const windowStart = Math.max(health.oldestLedger, health.latestLedger - LOOKBACK_LEDGERS);
	if (known.fromLedger <= windowStart) return null;
	const found = await scan(server, organization, tokens, windowStart, known.fromLedger);
	return merge({ fromLedger: windowStart, toLedger: known.toLedger, transfers: found }, known);
}

/** One page out of two: the union of their transfers over the union of their ranges. */
export function merge(page: HistoryPage, other: HistoryPage | null): HistoryPage {
	if (!other) return { ...page, transfers: newestLast(page.transfers) };
	const byId = new Map(other.transfers.map((transfer) => [transfer.id, transfer]));
	for (const transfer of page.transfers) byId.set(transfer.id, transfer);
	return {
		fromLedger: Math.min(page.fromLedger, other.fromLedger),
		toLedger: Math.max(page.toLedger, other.toLedger),
		transfers: newestLast([...byId.values()]),
	};
}

function newestLast(transfers: ChainTransfer[]): ChainTransfer[] {
	return transfers.sort((a, b) => a.at - b.at).slice(-KEEP);
}

/** Every transfer in `[from, end)`, read in chunks a few at a time. */
async function scan(
	server: rpc.Server,
	organization: string,
	tokens: readonly string[],
	from: number,
	end: number,
): Promise<ChainTransfer[]> {
	if (tokens.length === 0 || from >= end) return [];
	const filters = filtersFor(organization, tokens);
	const chunks: [number, number][] = [];
	for (let at = from; at < end; at += CHUNK_LEDGERS) {
		chunks.push([at, Math.min(at + CHUNK_LEDGERS, end)]);
	}
	const found = await inBatches(chunks, PARALLEL_CHUNKS, ([chunkFrom, chunkEnd]) =>
		readChunk(server, filters, chunkFrom, chunkEnd),
	);
	return found.flat();
}

/**
 * Token events carry the parties as address topics after the name: `transfer(from, to)`,
 * `mint(to)` (older tokens `mint(admin, to)`), Stellar assets add the asset as a last topic.
 * "**" matches whatever follows. RPC takes five contract ids per filter.
 */
function filtersFor(organization: string, tokens: readonly string[]): rpc.Api.EventFilter[] {
	const me = new Address(organization).toScVal().toXDR("base64");
	const filters: rpc.Api.EventFilter[] = [];
	for (let i = 0; i < tokens.length; i += 5) {
		filters.push({
			type: "contract",
			contractIds: tokens.slice(i, i + 5),
			topics: [
				["*", me, "**"],
				["*", "*", me, "**"],
			],
		});
	}
	return filters.slice(0, 5);
}

/**
 * One ledger range `[from, end)`. A full page means more may follow, so the next page starts at
 * the cursor; a short page's cursor sits on the last ledger scanned, which is `end - 1` once the
 * range is done. One retry covers a dropped connection to the public RPC.
 */
async function readChunk(
	server: rpc.Server,
	filters: rpc.Api.EventFilter[],
	from: number,
	end: number,
): Promise<ChainTransfer[]> {
	const transfers: ChainTransfer[] = [];
	let request: rpc.Api.GetEventsRequest = {
		startLedger: from,
		endLedger: end,
		filters,
		limit: PAGE,
	};
	for (let page = 0; page < 10; page++) {
		const response = await getEventsWithRetry(server, request);
		for (const event of response.events) {
			const transfer = toTransfer(event);
			if (transfer) transfers.push(transfer);
		}
		if (response.events.length < PAGE && cursorLedger(response.cursor) >= end - 1) break;
		// A cursor can't be paired with a ledger range; the page may run past `end`, and events
		// another chunk also finds are merged by id.
		request = { cursor: response.cursor, filters, limit: PAGE };
	}
	return transfers;
}

async function getEventsWithRetry(
	server: rpc.Server,
	request: rpc.Api.GetEventsRequest,
): Promise<rpc.Api.GetEventsResponse> {
	try {
		return await server.getEvents(request);
	} catch {
		await new Promise((resolve) => setTimeout(resolve, 400));
		return server.getEvents(request);
	}
}

/** The ledger an RPC event cursor points at (its first part is a TOID: ledger in the high bits). */
function cursorLedger(cursor: string): number {
	const [toid] = cursor.split("-");
	return toid && /^\d+$/.test(toid) ? Number(BigInt(toid) >> 32n) : 0;
}

function toTransfer(event: rpc.Api.EventResponse): ChainTransfer | null {
	// Newer RPC versions leave the success flag out: failed calls' events are not returned at all.
	if (event.inSuccessfulContractCall === false || !event.contractId) return null;
	const [name, ...rest] = event.topic;
	if (name?.switch().name !== "scvSymbol") return null;
	const parties = rest
		.filter((topic: xdr.ScVal) => topic.switch().name === "scvAddress")
		.map((topic: xdr.ScVal) => String(scValToNative(topic)));
	const token = event.contractId.contractId();
	const ends = partiesOf(name.sym().toString(), parties, token);
	if (!ends) return null;
	const amount = amountOf(scValToNative(event.value));
	if (amount === null) return null;
	return {
		id: event.id,
		txHash: event.txHash,
		at: Date.parse(event.ledgerClosedAt),
		token,
		from: ends.from,
		to: ends.to,
		amount,
	};
}

function partiesOf(
	name: string,
	parties: string[],
	token: string,
): { from: string; to: string } | null {
	const [first, second] = parties;
	if (name === "transfer" && first && second) return { from: first, to: second };
	const last = parties.at(-1);
	if (name === "mint" && last) return { from: token, to: last };
	return null;
}

/** Transfer amounts arrive as a plain i128 or, with unified events, as a map with `amount`. */
function amountOf(value: unknown): bigint | null {
	if (typeof value === "bigint") return value;
	if (value && typeof value === "object" && "amount" in value) {
		const amount = (value as { amount: unknown }).amount;
		return typeof amount === "bigint" ? amount : null;
	}
	return null;
}

async function inBatches<T, R>(
	items: readonly T[],
	size: number,
	run: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = [];
	for (let i = 0; i < items.length; i += size) {
		results.push(...(await Promise.all(items.slice(i, i + size).map(run))));
	}
	return results;
}
