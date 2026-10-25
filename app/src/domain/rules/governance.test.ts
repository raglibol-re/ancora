import { describe, expect, it } from "vitest";
import { euros } from "../money.ts";
import {
	applyChange,
	applyChangeDirectly,
	createOrg,
	isSetupPhase,
	switchTemplate,
} from "./governance.ts";
import type { Org } from "./model.ts";
import { club, company, orgWith, team } from "./testOrgs.ts";

function newClub(): Org {
	const result = createOrg({
		id: "o1",
		name: "Rowing club",
		templateId: "club",
		founderId: "tess",
		founderRoleId: "treasurer",
	});
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

describe("createOrg", () => {
	it("starts with the founder as the only member and the template's rules", () => {
		const org = newClub();
		expect(org.members).toEqual([{ personId: "tess", roleId: "treasurer" }]);
		expect(org.policy.sealThreshold).toBe(euros(10_000));
	});

	it("rejects a founder role the template doesn't have", () => {
		const result = createOrg({
			id: "o1",
			name: "x",
			templateId: "team",
			founderId: "a",
			founderRoleId: "treasurer",
		});
		expect(result).toMatchObject({ error: { code: "unknown-role" } });
	});
});

describe("setup phase", () => {
	it("lets the founder add members directly until others could satisfy the rules", () => {
		let org = newClub();
		expect(isSetupPhase(org)).toBe(true);

		const addBo = applyChangeDirectly(org, "tess", {
			type: "addMember",
			personId: "bo",
			roleId: "board",
		});
		if (!addBo.ok) throw new Error(addBo.error.message);
		org = addBo.value;
		expect(isSetupPhase(org)).toBe(true);

		const addBea = applyChangeDirectly(org, "tess", {
			type: "addMember",
			personId: "bea",
			roleId: "board",
		});
		if (!addBea.ok) throw new Error(addBea.error.message);
		org = addBea.value;
		expect(isSetupPhase(org)).toBe(false);

		expect(
			applyChangeDirectly(org, "tess", { type: "addMember", personId: "max", roleId: "member" }),
		).toMatchObject({ error: { code: "not-in-setup-phase" } });
	});

	it("is only available to the founder", () => {
		const org = orgWith("club", [
			["tess", "treasurer"],
			["bo", "board"],
		]);
		expect(
			applyChangeDirectly(org, "bo", { type: "addMember", personId: "x", roleId: "board" }),
		).toMatchObject({ error: { code: "not-in-setup-phase" } });
	});
});

describe("applyChange", () => {
	it("refuses a removal that would leave the strictest tier impossible", () => {
		const small = orgWith("club", [
			["tess", "treasurer"],
			["bo", "board"],
			["max", "member"],
		]);
		expect(applyChange(small, { type: "removeMember", personId: "bo" })).toMatchObject({
			error: { code: "would-lock-account" },
		});
	});

	it("allows removals that keep the rules satisfiable", () => {
		const result = applyChange(club(), { type: "removeMember", personId: "max" });
		expect(result.ok && result.value.members.map((m) => m.personId)).toEqual(["tess", "bo", "bea"]);
	});

	it("changes roles and rejects unknown roles", () => {
		const promoted = applyChange(club(), { type: "changeRole", personId: "max", roleId: "board" });
		expect(promoted.ok && promoted.value.members.find((m) => m.personId === "max")?.roleId).toBe(
			"board",
		);
		expect(
			applyChange(club(), { type: "changeRole", personId: "max", roleId: "ceo" }),
		).toMatchObject({
			error: { code: "unknown-role" },
		});
	});

	it("updates tier limits and the seal threshold after validation", () => {
		const org = club();
		const policy = { ...org.policy, sealThreshold: euros(25_000) };
		const result = applyChange(org, { type: "updatePolicy", policy });
		expect(result.ok && result.value.policy.sealThreshold).toBe(euros(25_000));
		expect(
			applyChange(org, { type: "updatePolicy", policy: { ...policy, sealThreshold: -1 } }),
		).toMatchObject({ error: { code: "invalid-policy" } });
	});
});

describe("switchTemplate", () => {
	it("maps members onto the new roles by rank", () => {
		const switched = switchTemplate(club(), "company");
		expect(switched.members).toEqual([
			{ personId: "tess", roleId: "director" },
			{ personId: "bo", roleId: "finance" },
			{ personId: "bea", roleId: "finance" },
			{ personId: "max", roleId: "employee" },
		]);
		expect(switched.policy).toEqual(company().policy);
	});

	it("clamps lower ranks onto the lowest role when the new template has fewer roles", () => {
		const switched = switchTemplate(club(), "team");
		expect(switched.members.map((m) => m.roleId)).toEqual(["lead", "member", "member", "member"]);
		expect(switched.roles).toEqual(team().roles);
	});

	it("is refused when the new rules couldn't be satisfied by the mapped members", () => {
		// The club has one treasurer, so the company template would have only one director.
		const result = applyChange(club(), { type: "switchTemplate", templateId: "company" });
		expect(result).toMatchObject({ error: { code: "would-lock-account" } });
	});
});
