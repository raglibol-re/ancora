import { xdr } from "@stellar/stellar-sdk";
import type {
	ClaimStatus,
	LifelineOverview,
	Protected,
	RecoveryClaim,
	RecoveryPlan,
} from "../../domain/lifeline.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u32, u64 } from "./scv.ts";

// Reads of ancora's recovery contract (contracts/recovery) and the arguments of its commands.
// Commands themselves go through the person's account (see TestnetDataSource.invoke).

type Native = Record<string, unknown>;

const seconds = (value: unknown): number => Number(value) * 1000;

function mapPlan(native: Native | null | undefined): RecoveryPlan | null {
	if (!native) return null;
	return {
		guardians: (native.guardians as unknown[]).map(String),
		threshold: Number(native.threshold),
		waitSeconds: Number(native.wait_seconds),
	};
}

function mapClaim(native: Native | null | undefined): RecoveryClaim | null {
	if (!native) return null;
	return {
		successor: String(native.successor),
		approvals: (native.approvals as unknown[]).map(String),
		startedAt: seconds(native.started_at),
		readyAt: seconds(native.ready_at),
	};
}

async function read(network: Network, recovery: string, fn: string, person: string) {
	return readContract(network, recovery, fn, [address(person)]);
}

/** Plan, open claim and handover state of one pass. */
export async function readClaimStatus(
	network: Network,
	recovery: string,
	person: string,
): Promise<ClaimStatus> {
	const [plan, claim, recoveredTo] = await Promise.all([
		read(network, recovery, "plan", person) as Promise<Native | null>,
		read(network, recovery, "claim", person) as Promise<Native | null>,
		read(network, recovery, "recovered_to", person) as Promise<string | null>,
	]);
	return { plan: mapPlan(plan), claim: mapClaim(claim), recoveredTo: recoveredTo ?? null };
}

/** The person's own plan and claim, plus the people who named them as guardian. */
export async function readOverview(
	network: Network,
	recovery: string,
	person: string,
): Promise<LifelineOverview> {
	const [status, wards] = await Promise.all([
		readClaimStatus(network, recovery, person),
		read(network, recovery, "protects", person) as Promise<unknown[]>,
	]);
	const protecting = (
		await Promise.all(
			wards.map(async (ward): Promise<Protected | null> => {
				const personId = String(ward);
				const theirs = await readClaimStatus(network, recovery, personId);
				return theirs.plan ? { personId, plan: theirs.plan, claim: theirs.claim } : null;
			}),
		)
	).filter((entry): entry is Protected => entry !== null);
	return { ...status, protecting };
}

/** The recovery contract's `Error` codes in plain language (contracts/recovery/src/lib.rs). */
const RECOVERY_ERROR_MESSAGES: Record<number, string> = {
	1: "This person has no recovery plan.",
	2: "A plan needs one to five different guardians (not yourself), a number of confirmations within them and a waiting period of at least a minute.",
	3: "Only the guardians this person named can do that.",
	4: "There is no open claim for this pass.",
	5: "A claim is already open for this pass; confirm it instead, or the old pass cancels it.",
	6: "You already confirmed this claim.",
	7: "Not enough confirmations yet, or the waiting period isn't over.",
	8: "The new pass must differ from the old one.",
	9: "Only organizations known to the registry take part.",
};

/** Turns the kit's "Error(Contract, #n)" into the recovery contract's plain-language text. */
export function recoveryMessage(message: string): string {
	const code = /Error\(Contract, #(\d+)\)/.exec(message)?.[1];
	return (code && RECOVERY_ERROR_MESSAGES[Number(code)]) || `Nothing was changed: ${message}`;
}

/** Arguments of `set_plan(person, guardians, threshold, wait_seconds)`. */
export const setPlanArgs = (person: string, plan: RecoveryPlan): xdr.ScVal[] => [
	address(person),
	xdr.ScVal.scvVec(plan.guardians.map(address)),
	u32(plan.threshold),
	u64(plan.waitSeconds),
];
