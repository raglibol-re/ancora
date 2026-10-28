import { describe, expect, it } from "vitest";
import { applyChange, createOrg } from "./governance.ts";
import { customRole, roleIdFromName } from "./roles.ts";

function club() {
	const created = createOrg({
		id: "club",
		name: "Tejo Rowing Club",
		templateId: "club",
		founderId: "ines",
		founderRoleId: "treasurer",
		baseCurrency: "EUR",
		assets: [{ token: "EURC", symbol: "EURC", currency: "EUR", vault: null }],
	});
	if (!created.ok) throw new Error(created.error.message);
	return created.value;
}

const ids = (names: string[]) => names.map(customRole);

describe("custom roles", () => {
	it("turns a typed name into a role id and back into a label", () => {
		expect(roleIdFromName("  Head Coach ")).toBe("head_coach");
		expect(roleIdFromName("9 lives")).toBeNull();
		expect(customRole("head_coach")).toEqual({
			id: "head_coach",
			name: "Head coach",
			plural: "Head coaches",
		});
		expect(customRole("secretary").plural).toBe("Secretaries");
		expect(customRole("member").plural).toBe("Members");
	});

	it("adds, reorders and drops roles nobody holds", () => {
		const org = club();
		const added = applyChange(org, {
			type: "setRoles",
			roles: ids(["treasurer", "board", "coach", "member"]),
		});
		expect(added.ok && added.value.roles.map((r) => r.id)).toEqual([
			"treasurer",
			"board",
			"coach",
			"member",
		]);
		const dropped = applyChange(org, { type: "setRoles", roles: ids(["treasurer", "board"]) });
		expect(dropped.ok).toBe(true);
	});

	it("refuses lists the contract would refuse, with the same reasons", () => {
		const org = club();
		const codeOf = (names: string[]) => {
			const result = applyChange(org, { type: "setRoles", roles: ids(names) });
			return result.ok ? "ok" : result.error.code;
		};
		expect(codeOf([])).toBe("invalid-roles");
		expect(codeOf(["treasurer", "board", "board"])).toBe("invalid-roles");
		expect(codeOf(["treasurer", "board", "a", "b", "c", "d", "e", "f", "g"])).toBe("invalid-roles");
		// Inês holds "treasurer".
		expect(codeOf(["board", "member"])).toBe("role-in-use");
		// The club's tiers ask for board approvals.
		expect(codeOf(["treasurer", "member"])).toBe("unknown-role");
	});
});
