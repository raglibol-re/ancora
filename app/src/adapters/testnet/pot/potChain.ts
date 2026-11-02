import { Address, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { scanEvents } from "../eventScan.ts";
import { ContractReadError, type Network, readContract } from "../readContract.ts";
import { address, struct, u32 } from "../scv.ts";
import { fieldOf, type Point, pointOf } from "./potCurve.ts";
import type { PotEvent } from "./potWallet.ts";

// The pot as the app reads it: an account's record, auditor keys, its events, and the XDR
// payloads the pot decodes (`#[contracttype]` structs: maps with sorted symbol keys).

export type PotAccount = {
	spendingKey: Point;
	viewingKey: Point;
	spendable: Point;
	receiving: Point;
	auditorId: number;
};

type Native = Record<string, unknown>;

const bytesOf = (value: unknown): Uint8Array => {
	if (value instanceof Uint8Array) return value;
	throw new ContractReadError("The pot answered with something that isn't bytes.");
};

/** The account's record in the pot; null when it has none (not registered). */
export async function readPotAccount(
	network: Network,
	pot: string,
	account: string,
): Promise<PotAccount | null> {
	let raw: Native;
	try {
		raw = (await readContract(network, pot, "confidential_balance", [address(account)])) as Native;
	} catch (error) {
		// The pot refuses to read an account that isn't registered (AccountNotRegistered).
		if (error instanceof ContractReadError && /Error\(Contract, #\d+\)/.test(error.message)) {
			return null;
		}
		throw error;
	}
	return {
		spendingKey: pointOf(bytesOf(raw.spending_public_key)),
		viewingKey: pointOf(bytesOf(raw.viewing_public_key)),
		spendable: pointOf(bytesOf(raw.spendable_commitment)),
		receiving: pointOf(bytesOf(raw.receiving_commitment)),
		auditorId: Number(raw.auditor_id),
	};
}

/** The auditor key registered under `id`. */
export async function readAuditorKey(network: Network, auditors: string, id: number) {
	return pointOf(bytesOf(await readContract(network, auditors, "get_key", [u32(id)])));
}

/** The number the next auditor key registered gets. */
export async function nextAuditorId(network: Network, auditors: string): Promise<number> {
	return Number(await readContract(network, auditors, "next_id"));
}

/** OpenZeppelin's `CircuitType`, a `repr(u32)` enum: it travels as its number. */
export const CIRCUIT_TYPE = { register: 0, withdraw: 1, transfer: 2 } as const;

/** The key the verifier holds for a circuit. */
export async function readVerifierKey(network: Network, verifier: string, circuit: number) {
	return bytesOf(await readContract(network, verifier, "get_verification_key", [u32(circuit)]));
}

/** `data` for a proof-carrying call: `{ payload, proof }` as the pot's `*Data` struct. */
export function potData(payload: Record<string, Uint8Array>, proof: Uint8Array): Uint8Array {
	const fields = Object.fromEntries(
		Object.entries(payload).map(([name, bytes]) => [name, xdr.ScVal.scvBytes(Buffer.from(bytes))]),
	);
	return struct({ payload: struct(fields), proof: xdr.ScVal.scvBytes(Buffer.from(proof)) }).toXDR();
}

/** About ten minutes of ledgers. */
const PRUNE_MARGIN_LEDGERS = 120;

/**
 * Every pot event naming `account` that the RPC still holds after ledger `after` (all it holds
 * when null), oldest first, and the last ledger read.
 */
export async function readPotEvents(
	network: Network,
	pot: string,
	account: string,
	after: number | null = null,
): Promise<{ events: PotEvent[]; toLedger: number }> {
	const server = new rpc.Server(network.rpcUrl);
	const health = await server.getHealth();
	const me = new Address(account).toScVal().toXDR("base64");
	const filters: rpc.Api.EventFilter[] = [
		{
			type: "contract",
			contractIds: [pot],
			topics: [
				["*", me, "**"],
				["*", "*", me, "**"],
			],
		},
	];
	// The oldest ledger moves on while the chunks are read; starting a little above it keeps the
	// first chunk from asking for a ledger the RPC just dropped.
	const oldest = health.oldestLedger + PRUNE_MARGIN_LEDGERS;
	const from = after === null ? oldest : Math.max(oldest, after + 1);
	const events = await scanEvents(server, filters, from, health.latestLedger + 1, toPotEvent);
	const unique = new Map(events.map((event) => [event.id, event]));
	const sorted = [...unique.values()].sort(
		(a, b) => a.ledger - b.ledger || a.id.localeCompare(b.id),
	);
	return { events: sorted, toLedger: health.latestLedger };
}

function toPotEvent(event: rpc.Api.EventResponse): PotEvent | null {
	if (event.inSuccessfulContractCall === false) return null;
	const [name, ...topics] = event.topic.map((topic) => scValToNative(topic) as unknown);
	const parties = topics.map(String);
	// Events carry their non-topic fields as a map; a merge carries none.
	const data = (scValToNative(event.value) ?? {}) as Native;
	const base = { id: event.id, ledger: event.ledger, at: Date.parse(event.ledgerClosedAt) };
	const field = (key: string) => fieldOf(bytesOf(data[key]));
	const [first = "", second = ""] = parties;
	switch (name) {
		case "register":
			return { ...base, kind: "register", account: first };
		case "deposit":
			return {
				...base,
				kind: "deposit",
				from: first,
				to: second,
				amount: BigInt(String(data.amount)),
			};
		case "merge":
			return { ...base, kind: "merge", account: first };
		case "withdraw":
			return {
				...base,
				kind: "withdraw",
				from: first,
				to: second,
				amount: BigInt(String(data.amount)),
				sigma: field("sigma"),
				bTilde: field("b_tilde"),
			};
		case "transfer":
			return {
				...base,
				kind: "transfer",
				from: first,
				to: second,
				ephemeral: pointOf(bytesOf(data.r_e_point)),
				vTilde: field("v_tilde"),
				sigma: field("sigma"),
				bTilde: field("b_tilde"),
				vTildeAudS: field("v_tilde_aud_s"),
			};
		default:
			return null;
	}
}
