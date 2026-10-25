import { describe, expect, it } from "vitest";
import { euros } from "../money.ts";
import type { Policy } from "./model.ts";
import {
	evaluateGovernance,
	evaluatePayment,
	mergeRequirements,
	validatePolicy,
} from "./policy.ts";
import { templates } from "./templates.ts";

const pay = (policy: Policy, amount: number, recipientIsNew = false) =>
	evaluatePayment(policy, { amount, recipientIsNew });

describe("evaluatePayment with the club template", () => {
	const { policy } = templates.club;

	it("needs no approval up to and including €200", () => {
		expect(pay(policy, euros(200))).toMatchObject({ tierIndex: 0, approvals: [] });
	});

	it("needs one board member from €200.01 to €2,000", () => {
		expect(pay(policy, euros(200) + 1).approvals).toEqual([{ roleId: "board", count: 1 }]);
		expect(pay(policy, euros(2_000)).tierIndex).toBe(1);
	});

	it("needs two board members and a 48h objection window above €2,000", () => {
		expect(pay(policy, euros(2_000) + 1)).toMatchObject({
			tierIndex: 2,
			approvals: [{ roleId: "board", count: 2 }],
			objectionWindowHours: 48,
			sealRequired: false,
		});
	});

	it("requires the seal at exactly the threshold, not below", () => {
		expect(pay(policy, euros(10_000) - 1).sealRequired).toBe(false);
		expect(pay(policy, euros(10_000)).sealRequired).toBe(true);
	});
});

describe("evaluatePayment with the company template", () => {
	const { policy } = templates.company;

	it("adds a director for a first payment to a new recipient", () => {
		expect(pay(policy, euros(500), true).approvals).toEqual([{ roleId: "director", count: 1 }]);
	});

	it("keeps the higher count when the tier already requires directors", () => {
		expect(pay(policy, euros(5_000), true).approvals).toEqual([{ roleId: "director", count: 1 }]);
		expect(pay(policy, euros(30_000), true).approvals).toEqual([{ roleId: "director", count: 2 }]);
	});

	it("requires the seal from €50,000", () => {
		expect(pay(policy, euros(50_000)).sealRequired).toBe(true);
	});
});

describe("evaluateGovernance", () => {
	it("uses the strictest tier and never the seal", () => {
		expect(evaluateGovernance(templates.club.policy)).toEqual({
			tierIndex: null,
			approvals: [{ roleId: "board", count: 2 }],
			objectionWindowHours: 48,
			sealRequired: false,
		});
	});
});

describe("mergeRequirements", () => {
	it("keeps roles from both sides and the higher count per role", () => {
		expect(
			mergeRequirements(
				[
					{ roleId: "member", count: 2 },
					{ roleId: "lead", count: 1 },
				],
				[
					{ roleId: "lead", count: 2 },
					{ roleId: "board", count: 1 },
				],
			),
		).toEqual([
			{ roleId: "member", count: 2 },
			{ roleId: "lead", count: 2 },
			{ roleId: "board", count: 1 },
		]);
	});
});

describe("validatePolicy", () => {
	const { roles, policy } = templates.club;
	const withTiers = (tiers: Policy["tiers"]): Policy => ({ ...policy, tiers });

	it("accepts every template", () => {
		for (const template of Object.values(templates)) {
			expect(validatePolicy(template.policy, template.roles).ok).toBe(true);
		}
	});

	it("rejects a policy whose last tier has an upper limit", () => {
		const result = validatePolicy(
			withTiers([{ upTo: euros(100), approvals: [], objectionWindowHours: 0 }]),
			roles,
		);
		expect(result).toMatchObject({ ok: false, error: { code: "invalid-policy" } });
	});

	it("rejects limits that don't increase", () => {
		const result = validatePolicy(
			withTiers([
				{ upTo: euros(500), approvals: [], objectionWindowHours: 0 },
				{ upTo: euros(500), approvals: [], objectionWindowHours: 0 },
				{ upTo: null, approvals: [], objectionWindowHours: 0 },
			]),
			roles,
		);
		expect(result.ok).toBe(false);
	});

	it("rejects unknown roles and zero counts", () => {
		const unknown = withTiers([
			{ upTo: null, approvals: [{ roleId: "ceo", count: 1 }], objectionWindowHours: 0 },
		]);
		const zero = withTiers([
			{ upTo: null, approvals: [{ roleId: "board", count: 0 }], objectionWindowHours: 0 },
		]);
		expect(validatePolicy(unknown, roles)).toMatchObject({ error: { code: "unknown-role" } });
		expect(validatePolicy(zero, roles)).toMatchObject({ error: { code: "invalid-policy" } });
	});

	it("rejects a non-positive seal threshold", () => {
		expect(validatePolicy({ ...policy, sealThreshold: 0 }, roles).ok).toBe(false);
	});
});
