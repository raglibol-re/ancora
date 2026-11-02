import type { rpc } from "@stellar/stellar-sdk";

// Reading contract events over a range of ledgers. Soroban RPC scans at most ten thousand
// ledgers per request, so a range is read in chunks, a few at a time, each paged by cursor.

/** Below what RPC scans before cutting a request off, so one chunk is normally one request. */
export const CHUNK_LEDGERS = 8_000;
const PARALLEL_CHUNKS = 4;
const PAGE = 500;

/** Every event `filters` match in `[from, end)` that `toItem` keeps. A chunk that fails fails the read. */
export async function scanEvents<T>(
	server: rpc.Server,
	filters: rpc.Api.EventFilter[],
	from: number,
	end: number,
	toItem: (event: rpc.Api.EventResponse) => T | null,
): Promise<T[]> {
	if (from >= end) return [];
	const chunks: [number, number][] = [];
	for (let at = from; at < end; at += CHUNK_LEDGERS) {
		chunks.push([at, Math.min(at + CHUNK_LEDGERS, end)]);
	}
	const found = await inBatches(chunks, PARALLEL_CHUNKS, ([chunkFrom, chunkEnd]) =>
		readChunk(server, filters, chunkFrom, chunkEnd, toItem),
	);
	return found.flat();
}

/**
 * One ledger range `[from, end)`. A full page means more may follow, so the next page starts at
 * the cursor; a short page's cursor sits on the last ledger scanned, which is `end - 1` once the
 * range is done. One retry covers a dropped connection to the public RPC.
 */
async function readChunk<T>(
	server: rpc.Server,
	filters: rpc.Api.EventFilter[],
	from: number,
	end: number,
	toItem: (event: rpc.Api.EventResponse) => T | null,
): Promise<T[]> {
	const found: T[] = [];
	let request: rpc.Api.GetEventsRequest = {
		startLedger: from,
		endLedger: end,
		filters,
		limit: PAGE,
	};
	for (let page = 0; page < 10; page++) {
		const response = await getEventsWithRetry(server, request);
		for (const event of response.events) {
			const item = toItem(event);
			if (item) found.push(item);
		}
		if (response.events.length < PAGE && cursorLedger(response.cursor) >= end - 1) break;
		// A cursor can't be paired with a ledger range; the page may run past `end`, and events
		// another chunk also finds are merged by id.
		request = { cursor: response.cursor, filters, limit: PAGE };
	}
	return found;
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
