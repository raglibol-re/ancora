import {
	type PolicyDocumentV2,
	type PolicyDocumentV3,
	policyDocumentHash,
} from "../../../shared/policyDocument.ts";
import type { Currency } from "../money.ts";
import type { Policy, Role, TemplateId } from "./model.ts";

/** The declarative document an organization's rules are compiled from (current version). */
export function buildPolicyDocument(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
	currency: Currency,
): PolicyDocumentV3 {
	return {
		ancora: "policy/3",
		template: templateId,
		roles: roles.map((role) => role.id),
		unit: "cent",
		currency,
		tiers: policy.tiers.map((tier) => ({
			...(tier.upTo === null ? {} : { upTo: String(tier.upTo) }),
			approvals: tier.approvals.map((r) => ({ role: r.roleId, count: r.count })),
			objectionWindowHours: tier.objectionWindowHours,
		})),
		sealThreshold: String(policy.sealThreshold),
		newRecipientApprovals: policy.newRecipientApprovals.map((r) => ({
			role: r.roleId,
			count: r.count,
		})),
		budgets: policy.budgets.map((budget) => ({
			category: budget.category,
			amount: String(budget.amount),
			periodSeconds: budget.periodSeconds,
			mode: budget.hard ? "hard" : "soft",
		})),
	};
}

/** The document as organizations created before 26 Oct 2026 hashed it (no budgets). */
export function buildLegacyPolicyDocument(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
	currency: Currency,
): PolicyDocumentV2 {
	return {
		ancora: "policy/2",
		template: templateId,
		roles: roles.map((role) => role.id),
		unit: "cent",
		currency,
		tiers: policy.tiers.map((tier) => ({
			upTo: tier.upTo,
			approvals: tier.approvals.map((r) => ({ role: r.roleId, count: r.count })),
			objectionWindowHours: tier.objectionWindowHours,
		})),
		sealThreshold: policy.sealThreshold,
		newRecipientApprovals: policy.newRecipientApprovals.map((r) => ({
			role: r.roleId,
			count: r.count,
		})),
	};
}

export function rulesHash(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
	currency: Currency,
) {
	return policyDocumentHash(buildPolicyDocument(templateId, roles, policy, currency));
}

export function legacyRulesHash(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
	currency: Currency,
) {
	return policyDocumentHash(buildLegacyPolicyDocument(templateId, roles, policy, currency));
}
