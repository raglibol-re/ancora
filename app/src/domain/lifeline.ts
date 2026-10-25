import type { PersonId } from "./rules/model.ts";

// Lifeline: if a person loses their pass (passkey), the guardians they named confirm a new
// pass; after a waiting period their positions in every organization move to it. Recovery
// restores control, never money, and the old pass can cancel a claim while it waits. The
// contract (`contracts/recovery`) holds the truth; these are its shapes and the pure helpers.

export type RecoveryPlan = {
	guardians: readonly PersonId[];
	/** How many guardians must confirm. */
	threshold: number;
	waitSeconds: number;
};

export type RecoveryClaim = {
	/** The new pass the guardians vouch for. */
	successor: PersonId;
	approvals: readonly PersonId[];
	startedAt: number;
	/** Earliest moment the claim can be finished, ms. */
	readyAt: number;
};

/** Someone who named me as a guardian, with their plan and open claim. */
export type Protected = {
	personId: PersonId;
	plan: RecoveryPlan;
	claim: RecoveryClaim | null;
};

/** Everything Lifeline knows about one person, from their point of view. */
export type LifelineOverview = {
	plan: RecoveryPlan | null;
	/** An open claim on this person's pass (someone says they have a new pass). */
	claim: RecoveryClaim | null;
	/** Set once this pass's positions were handed to a new pass. */
	recoveredTo: PersonId | null;
	protecting: readonly Protected[];
};

/** What a person watching their own recovery (from the new pass) needs to see. */
export type ClaimStatus = {
	plan: RecoveryPlan | null;
	claim: RecoveryClaim | null;
	recoveredTo: PersonId | null;
};

export const MAX_GUARDIANS = 5;
export const MIN_WAIT_SECONDS = 60;

export const WAIT_OPTIONS: readonly { seconds: number; label: string }[] = [
	{ seconds: 120, label: "2 minutes (demo)" },
	{ seconds: 86_400, label: "1 day" },
	{ seconds: 7 * 86_400, label: "7 days" },
	{ seconds: 30 * 86_400, label: "30 days" },
];

export function describeWait(seconds: number): string {
	const option = WAIT_OPTIONS.find((o) => o.seconds === seconds);
	if (option) return option.label.replace(" (demo)", "");
	if (seconds % 86_400 === 0) return `${seconds / 86_400} days`;
	if (seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
	return `${Math.round(seconds / 60)} minutes`;
}

export type PlanProblem = "no-guardians" | "too-many" | "self" | "duplicate" | "threshold" | "wait";

/** The same checks the contract makes, so the form can explain before signing. */
export function validatePlan(me: PersonId, plan: RecoveryPlan): PlanProblem | null {
	if (plan.guardians.length === 0) return "no-guardians";
	if (plan.guardians.length > MAX_GUARDIANS) return "too-many";
	if (plan.guardians.includes(me)) return "self";
	if (new Set(plan.guardians).size !== plan.guardians.length) return "duplicate";
	if (plan.threshold < 1 || plan.threshold > plan.guardians.length) return "threshold";
	if (plan.waitSeconds < MIN_WAIT_SECONDS) return "wait";
	return null;
}

export function describePlanProblem(problem: PlanProblem): string {
	switch (problem) {
		case "no-guardians":
			return "Name at least one guardian.";
		case "too-many":
			return `Up to ${MAX_GUARDIANS} guardians.`;
		case "self":
			return "You can't be your own guardian.";
		case "duplicate":
			return "Each guardian once.";
		case "threshold":
			return "The number of confirmations must be between 1 and the number of guardians.";
		case "wait":
			return "The waiting period is at least a minute.";
	}
}

export type ClaimProgress = {
	confirmed: number;
	needed: number;
	/** Milliseconds left in the waiting period; 0 when over. */
	waitLeftMs: number;
	ready: boolean;
};

export function claimProgress(
	plan: RecoveryPlan,
	claim: RecoveryClaim,
	now: number,
): ClaimProgress {
	const confirmed = claim.approvals.length;
	const waitLeftMs = Math.max(0, claim.readyAt - now);
	return {
		confirmed,
		needed: plan.threshold,
		waitLeftMs,
		ready: confirmed >= plan.threshold && waitLeftMs === 0,
	};
}

/** "in 1 h 58 min", "in 3 days", "now". */
export function describeTimeLeft(ms: number): string {
	if (ms <= 0) return "now";
	const minutes = Math.ceil(ms / 60_000);
	if (minutes < 60) return `in ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `in ${hours} h ${minutes % 60} min`;
	return `in ${Math.ceil(hours / 24)} days`;
}
