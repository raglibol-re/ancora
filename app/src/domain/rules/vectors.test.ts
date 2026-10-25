import { describe, expect, it } from "vitest";
import vectors from "../../../../contracts/test-vectors/approval-rules.json";
import { approvalProgress } from "./approvals.ts";
import { isSetupPhase } from "./governance.ts";
import type { Org, Policy, Requirement, TemplateId } from "./model.ts";
import { evaluateGovernance, evaluatePayment } from "./policy.ts";
import { templates } from "./templates.ts";

// The same file drives the Soroban contract tests, so both engines provably agree.

type OrgKey = keyof typeof vectors.orgs;

function orgFor(key: string): Org {
	const fixture = vectors.orgs[key as OrgKey];
	if (!fixture) throw new Error(`Unknown org fixture "${key}"`);
	const policy: Policy =
		typeof fixture.policy === "string" ? policyOf(fixture.policy) : fixture.policy;
	return {
		id: key,
		name: key,
		templateId: "club",
		roles: fixture.roles.map((id) => ({ id, name: id, plural: id })),
		members: fixture.members,
		policy,
		founderId: fixture.members[0]?.personId ?? "",
	};
}

function policyOf(key: string): Policy {
	const fixture = vectors.orgs[key as OrgKey];
	if (!fixture || typeof fixture.policy === "string") throw new Error(`No policy for "${key}"`);
	return fixture.policy;
}

const asSet = (requirements: readonly Requirement[]) =>
	[...requirements].sort((a, b) => a.roleId.localeCompare(b.roleId));

describe("shared vectors stay in sync with the templates", () => {
	it.each(["club", "company", "team"] as const)("%s", (id: TemplateId) => {
		expect(policyOf(id)).toEqual(templates[id].policy);
		expect(vectors.orgs[id].roles).toEqual(templates[id].roles.map((role) => role.id));
	});
});

describe("payment vectors", () => {
	it.each(vectors.payments)("$name", (vector) => {
		const org = orgFor(vector.org);
		const evaluation = evaluatePayment(org.policy, vector);
		const progress = approvalProgress(
			org,
			evaluation.approvals,
			vector.approvals,
			vector.requester,
		);
		const complete = progress.satisfied && (!evaluation.sealRequired || vector.sealed);

		expect({
			tier: evaluation.tierIndex,
			approvals: asSet(evaluation.approvals),
			objectionWindowHours: evaluation.objectionWindowHours,
			sealRequired: evaluation.sealRequired,
			countedCount: progress.counted.length,
			complete,
		}).toEqual({ ...vector.expect, approvals: asSet(vector.expect.approvals) });
	});
});

describe("governance vectors", () => {
	it.each(vectors.governance)("$name", (vector) => {
		const org = orgFor(vector.org);
		const evaluation = evaluateGovernance(org.policy);
		const progress = approvalProgress(
			org,
			evaluation.approvals,
			vector.approvals,
			vector.requester,
		);

		expect({
			approvals: asSet(evaluation.approvals),
			objectionWindowHours: evaluation.objectionWindowHours,
			countedCount: progress.counted.length,
			complete: progress.satisfied,
		}).toEqual({ ...vector.expect, approvals: asSet(vector.expect.approvals) });
	});
});

describe("setup phase vectors", () => {
	it.each(vectors.setupPhase)("$name", (vector) => {
		expect(isSetupPhase(orgFor(vector.org))).toBe(vector.expect);
	});
});
