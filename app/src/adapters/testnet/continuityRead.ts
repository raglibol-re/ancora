import type { Succession } from "../../domain/rules/model.ts";
import { type Network, readContract } from "./readContract.ts";
import { address } from "./scv.ts";

// Lifeline inside the organization and quantum-safe seals (interface 9): succession plans with
// last-seen times and open claims, the seal verifier, and which members registered a seal key.

type Native = Record<string, unknown>;

export type Continuity = {
	successions: Succession[];
	sealVerifier: string | null;
	/** Members with a registered ML-DSA seal key. */
	sealKeyHolders: ReadonlySet<string>;
};

export async function readContinuity(
	network: Network,
	contractId: string,
	members: readonly string[],
): Promise<Continuity> {
	const [rows, verifier, keys] = await Promise.all([
		readContract(network, contractId, "successions") as Promise<Native[]>,
		readContract(network, contractId, "seal_verifier") as Promise<string | null>,
		Promise.all(
			members.map((member) => readContract(network, contractId, "seal_key", [address(member)])),
		),
	]);
	return {
		successions: rows.map((row) => ({
			personId: String(row.member),
			successorId: String(row.successor),
			inactiveSeconds: Number(row.inactive_seconds),
			waitSeconds: Number(row.wait_seconds),
			lastSeen: Number(row.last_seen) * 1000,
			claimReadyAt:
				row.claim_ready_at === null || row.claim_ready_at === undefined
					? null
					: Number(row.claim_ready_at) * 1000,
		})),
		sealVerifier: verifier ? String(verifier) : null,
		sealKeyHolders: new Set(
			members.filter((_, index) => keys[index] !== null && keys[index] !== undefined),
		),
	};
}
