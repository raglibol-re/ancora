import { describe, expect, it } from "vitest";
import { approvalProgress, approvalWouldCount, isEligibleApprover } from "./approvals.ts";
import type { Requirement } from "./model.ts";
import { club, team } from "./testOrgs.ts";

const twoBoard: Requirement[] = [{ roleId: "board", count: 2 }];

describe("approvalProgress", () => {
	it("never counts the requester's own approval (four-eyes)", () => {
		const progress = approvalProgress(club(), twoBoard, ["bo", "bea"], "bo");
		expect(progress.counted).toEqual(["bea"]);
		expect(progress.satisfied).toBe(false);
	});

	it("counts each person once", () => {
		const progress = approvalProgress(club(), twoBoard, ["bo", "bo"], "max");
		expect(progress.counted).toEqual(["bo"]);
	});

	it("ignores people outside the organization", () => {
		const progress = approvalProgress(club(), twoBoard, ["bo", "stranger"], "max");
		expect(progress.counted).toEqual(["bo"]);
	});

	it("ignores roles below the required one", () => {
		const progress = approvalProgress(club(), twoBoard, ["bo", "max"], "tess");
		expect(progress.satisfied).toBe(false);
	});

	it("lets a higher role fill a lower role's slot", () => {
		const progress = approvalProgress(club(), twoBoard, ["tess", "bo"], "max");
		expect(progress.satisfied).toBe(true);
	});

	it("fills the most demanding slots first so mixed requirements resolve correctly", () => {
		const leadAndTwoMembers: Requirement[] = [
			{ roleId: "member", count: 2 },
			{ roleId: "lead", count: 1 },
		];
		const org = team();
		const withThirdMember = {
			...org,
			members: [...org.members, { personId: "max", roleId: "member" }],
		};
		expect(
			approvalProgress(withThirdMember, leadAndTwoMembers, ["mo", "mia", "max"], "lea").satisfied,
		).toBe(false);
		const withSecondLead = {
			...org,
			members: [...org.members, { personId: "lars", roleId: "lead" }],
		};
		const progress = approvalProgress(
			withSecondLead,
			leadAndTwoMembers,
			["mo", "lea", "lars"],
			"mia",
		);
		expect(progress.satisfied).toBe(true);
		expect(progress.slots.find((s) => s.roleId === "lead")?.approvedBy).toEqual(["lea"]);
	});

	it("is satisfied immediately when nothing is required", () => {
		expect(approvalProgress(club(), [], [], "max").satisfied).toBe(true);
	});
});

describe("isEligibleApprover", () => {
	it("accepts the role or higher and rejects lower roles and strangers", () => {
		expect(isEligibleApprover(club(), twoBoard, "tess")).toBe(true);
		expect(isEligibleApprover(club(), twoBoard, "bo")).toBe(true);
		expect(isEligibleApprover(club(), twoBoard, "max")).toBe(false);
		expect(isEligibleApprover(club(), twoBoard, "stranger")).toBe(false);
	});
});

describe("approvalWouldCount", () => {
	it("is false once the slots this person could fill are taken", () => {
		const oneLead: Requirement[] = [
			{ roleId: "lead", count: 1 },
			{ roleId: "member", count: 1 },
		];
		expect(approvalWouldCount(team(), oneLead, ["mo"], "x", "mia")).toBe(false);
		expect(approvalWouldCount(team(), oneLead, ["mo"], "x", "lea")).toBe(true);
	});
});
