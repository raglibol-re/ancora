import type { LifelineSupport } from "../../domain/dataSource.ts";
import {
	type ClaimStatus,
	claimProgress,
	describePlanProblem,
	type LifelineOverview,
	type RecoveryClaim,
	type RecoveryPlan,
	validatePlan,
} from "../../domain/lifeline.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";

type Handover = {
	/** Moves every position of `old` to `successor`; returns which organizations did. */
	handOver: (old: PersonId, successor: PersonId) => string[];
	clock: () => number;
};

const refuse = (message: string) => err(ruleError("not-allowed", message));

/**
 * The recovery contract's rules, in memory, for sample data: plans, claims with a waiting
 * period, cancellation by the old pass, handover to the new one. Simulated; nothing persists.
 */
export class LocalLifeline implements LifelineSupport {
	private readonly plans = new Map<PersonId, RecoveryPlan>();
	private readonly claims = new Map<PersonId, RecoveryClaim>();
	private readonly recovered = new Map<PersonId, PersonId>();
	private readonly deps: Handover;

	constructor(deps: Handover) {
		this.deps = deps;
	}

	/** Seeds a plan without a signature (demo setup). */
	seedPlan(person: PersonId, plan: RecoveryPlan): void {
		this.plans.set(person, plan);
	}

	async overview(personId: PersonId): Promise<Result<LifelineOverview, RuleError>> {
		const protecting = [...this.plans.entries()]
			.filter(([, plan]) => plan.guardians.includes(personId))
			.map(([person, plan]) => ({
				personId: person,
				plan,
				claim: this.claims.get(person) ?? null,
			}));
		return ok({ ...this.status(personId), protecting });
	}

	async claimOf(personId: PersonId): Promise<Result<ClaimStatus, RuleError>> {
		return ok(this.status(personId));
	}

	async setPlan(personId: PersonId, plan: RecoveryPlan): Promise<Result<void, RuleError>> {
		const problem = validatePlan(personId, plan);
		if (problem) return refuse(describePlanProblem(problem));
		this.plans.set(personId, { ...plan, guardians: [...plan.guardians] });
		this.claims.delete(personId);
		return ok(undefined);
	}

	async clearPlan(personId: PersonId): Promise<Result<void, RuleError>> {
		if (!this.plans.delete(personId)) return refuse("There is no recovery plan to remove.");
		this.claims.delete(personId);
		return ok(undefined);
	}

	async startClaim(
		personId: PersonId,
		guardianId: PersonId,
		successorId: PersonId,
	): Promise<Result<void, RuleError>> {
		const plan = this.guardianPlan(personId, guardianId);
		if (!plan.ok) return plan;
		if (successorId === personId) return refuse("The new pass must differ from the old one.");
		if (this.claims.has(personId)) {
			return refuse("A claim is already open for this pass; confirm it instead.");
		}
		const now = this.deps.clock();
		this.claims.set(personId, {
			successor: successorId,
			approvals: [guardianId],
			startedAt: now,
			readyAt: now + plan.value.waitSeconds * 1000,
		});
		return ok(undefined);
	}

	async approveClaim(personId: PersonId, guardianId: PersonId): Promise<Result<void, RuleError>> {
		const plan = this.guardianPlan(personId, guardianId);
		if (!plan.ok) return plan;
		const claim = this.claims.get(personId);
		if (!claim) return refuse("There is no open claim for this pass.");
		if (claim.approvals.includes(guardianId)) return refuse("You already confirmed this claim.");
		this.claims.set(personId, { ...claim, approvals: [...claim.approvals, guardianId] });
		return ok(undefined);
	}

	async cancelClaim(personId: PersonId): Promise<Result<void, RuleError>> {
		if (!this.claims.delete(personId)) return refuse("There is no open claim to cancel.");
		return ok(undefined);
	}

	async finishClaim(
		personId: PersonId,
	): Promise<Result<{ successor: PersonId; recovered: string[]; skipped: string[] }, RuleError>> {
		const already = this.recovered.get(personId);
		if (already) {
			return ok({
				successor: already,
				recovered: this.deps.handOver(personId, already),
				skipped: [],
			});
		}
		const plan = this.plans.get(personId);
		const claim = this.claims.get(personId);
		if (!plan || !claim) return refuse("There is no open recovery for this pass.");
		const progress = claimProgress(plan, claim, this.deps.clock());
		if (!progress.ready) {
			return refuse(
				progress.confirmed < progress.needed
					? `Only ${progress.confirmed} of ${progress.needed} guardians have confirmed so far.`
					: "The waiting period isn't over yet.",
			);
		}
		this.recovered.set(personId, claim.successor);
		this.claims.delete(personId);
		const recovered = this.deps.handOver(personId, claim.successor);
		return ok({ successor: claim.successor, recovered, skipped: [] });
	}

	private status(personId: PersonId): ClaimStatus {
		return {
			plan: this.plans.get(personId) ?? null,
			claim: this.claims.get(personId) ?? null,
			recoveredTo: this.recovered.get(personId) ?? null,
		};
	}

	private guardianPlan(personId: PersonId, guardianId: PersonId): Result<RecoveryPlan, RuleError> {
		const plan = this.plans.get(personId);
		if (!plan) return refuse("This person has no recovery plan.");
		if (!plan.guardians.includes(guardianId)) {
			return refuse("Only the guardians this person named can do that.");
		}
		return ok(plan);
	}
}
