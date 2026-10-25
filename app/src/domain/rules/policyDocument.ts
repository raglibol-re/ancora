import { type PolicyDocument, policyDocumentHash } from "../../../shared/policyDocument.ts";
import type { Policy, Role, TemplateId } from "./model.ts";

/** The declarative document an organization's rules are compiled from. */
export function buildPolicyDocument(
	templateId: TemplateId,
	roles: readonly Role[],
	policy: Policy,
): PolicyDocument {
	return {
		ancora: "policy/1",
		template: templateId,
		roles: roles.map((role) => role.id),
		unit: "cent",
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

export function rulesHash(templateId: TemplateId, roles: readonly Role[], policy: Policy) {
	return policyDocumentHash(buildPolicyDocument(templateId, roles, policy));
}
