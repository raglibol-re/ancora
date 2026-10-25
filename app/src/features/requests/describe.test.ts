import { describe, expect, it } from "vitest";
import { euros } from "../../domain/money.ts";
import { evaluateGovernance, evaluatePayment } from "../../domain/rules/policy.ts";
import { club, company, team } from "../../domain/rules/testOrgs.ts";
import { describeChange, describeEvaluation, describeRequirements } from "./describe.ts";

const names = (id: string) => ({ bo: "Bo Lind", max: "Max Rey" })[id] ?? id;

describe("describeEvaluation", () => {
	it("says when nothing is needed", () => {
		const org = club();
		expect(
			describeEvaluation(
				org,
				evaluatePayment(org.policy, { amount: euros(50), recipientIsNew: false }),
			),
		).toBe("No approval needed. It goes out right away.");
	});

	it("names approvals, the objection window and the seal", () => {
		const org = club();
		const evaluation = evaluatePayment(org.policy, {
			amount: euros(12_000),
			recipientIsNew: false,
		});
		expect(describeEvaluation(org, evaluation)).toBe(
			"Needs 2 board members, then a 48-hour objection window. The security seal is required.",
		);
	});

	it("describes the strictest tier for changes", () => {
		const org = company();
		expect(describeEvaluation(org, evaluateGovernance(org.policy))).toBe(
			"Needs 2 managing directors.",
		);
	});
});

describe("describeRequirements", () => {
	it("joins several roles", () => {
		const org = team();
		expect(describeRequirements(org, org.policy.tiers[2]?.approvals ?? [])).toBe(
			"2 members and 1 team lead",
		);
	});
});

describe("describeChange", () => {
	it("uses names and role labels", () => {
		const org = club();
		expect(
			describeChange(org, { type: "addMember", personId: "max", roleId: "board" }, names),
		).toBe("Add Max Rey as board member");
		expect(describeChange(org, { type: "switchTemplate", templateId: "company" }, names)).toBe(
			"Switch to the company template",
		);
	});
});
