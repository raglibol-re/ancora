import { type PolicyDocument, policyDocumentHash } from "../../../shared/policyDocument.ts";
import type { Currency } from "../money.ts";
import type { Policy, Role, TemplateId } from "./model.ts";

/** The declarative document an organization's rules are compiled from. */
export function buildPolicyDocument(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
	currency: Currency,
): PolicyDocument {
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
