import { type Cents, isValidAmount } from "../money.ts";
import { err, ok, type Result } from "../result.ts";
import {
	type Evaluation,
	type Policy,
	type Requirement,
	type Role,
	type RuleError,
	ruleError,
	type Tier,
} from "./model.ts";

/** Thrown when code evaluates a policy that never passed validatePolicy. A programming error. */
export class InvalidPolicyError extends Error {}

export function validatePolicy(policy: Policy, roles: readonly Role[]): Result<Policy, RuleError> {
	const invalid = (message: string) => err(ruleError("invalid-policy", message));
	const { tiers } = policy;
	const last = tiers.at(-1);
	if (!last || last.upTo !== null) {
		return invalid("The last tier must have no upper limit, so every amount is covered.");
	}
	for (const [index, tier] of tiers.entries()) {
		const previous = tiers[index - 1];
		if (index < tiers.length - 1 && !isValidAmount(tier.upTo ?? Number.NaN)) {
			return invalid(`Tier ${index + 1} needs an upper limit above zero.`);
		}
		if (previous?.upTo != null && tier.upTo !== null && tier.upTo <= previous.upTo) {
			return invalid(`Tier ${index + 1} must start above the limit of tier ${index}.`);
		}
		if (!Number.isInteger(tier.objectionWindowHours) || tier.objectionWindowHours < 0) {
			return invalid(`Tier ${index + 1} has an invalid objection window; use whole hours.`);
		}
	}
	if (!isValidAmount(policy.sealThreshold)) {
		return invalid("The security seal threshold must be an amount above zero.");
	}
	const allRequirements = [
		...tiers.flatMap((tier) => tier.approvals),
		...policy.newRecipientApprovals,
	];
	for (const requirement of allRequirements) {
		if (!roles.some((role) => role.id === requirement.roleId)) {
			return err(ruleError("unknown-role", "The rules mention a role that doesn't exist."));
		}
		if (!Number.isInteger(requirement.count) || requirement.count < 1) {
			return invalid("Each required approval needs a count of at least 1.");
		}
	}
	return ok(policy);
}

/** Per role, keep the higher count. */
export function mergeRequirements(
	base: readonly Requirement[],
	extra: readonly Requirement[],
): Requirement[] {
	const merged = new Map(base.map((r) => [r.roleId, r.count]));
	for (const { roleId, count } of extra) {
		merged.set(roleId, Math.max(merged.get(roleId) ?? 0, count));
	}
	return [...merged].map(([roleId, count]) => ({ roleId, count }));
}

export type PaymentFacts = {
	amount: Cents;
	recipientIsNew: boolean;
	/**
	 * The payment is in an asset of another currency than the rules, and no rate is available:
	 * it takes the strictest tier and the seal, so it is never under-approved.
	 */
	foreignCurrency?: boolean;
};

export function evaluatePayment(policy: Policy, payment: PaymentFacts): Evaluation {
	const tierIndex = payment.foreignCurrency
		? policy.tiers.length - 1
		: policy.tiers.findIndex((tier) => tier.upTo === null || payment.amount <= tier.upTo);
	const tier = tierAt(policy, tierIndex);
	return {
		tierIndex,
		approvals: payment.recipientIsNew
			? mergeRequirements(tier.approvals, policy.newRecipientApprovals)
			: [...tier.approvals],
		objectionWindowHours: tier.objectionWindowHours,
		sealRequired: payment.foreignCurrency === true || payment.amount >= policy.sealThreshold,
	};
}

/** A payment inside the requester's spending limit: nothing to approve, out it goes. */
export function limitEvaluation(): Evaluation {
	return {
		tierIndex: null,
		approvals: [],
		objectionWindowHours: 0,
		sealRequired: false,
		withinLimit: true,
	};
}

/** Membership and rule changes always use the strictest (last) tier, without the seal. */
export function evaluateGovernance(policy: Policy): Evaluation {
	const tier = strictestTier(policy);
	return {
		tierIndex: null,
		approvals: [...tier.approvals],
		objectionWindowHours: tier.objectionWindowHours,
		sealRequired: false,
	};
}

export function strictestTier(policy: Policy): Tier {
	return tierAt(policy, policy.tiers.length - 1);
}

function tierAt(policy: Policy, index: number): Tier {
	const tier = policy.tiers[index];
	if (!tier) throw new InvalidPolicyError("Policy has no tier covering this amount.");
	return tier;
}
