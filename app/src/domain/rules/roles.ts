import { err, ok, type Result } from "../result.ts";
import { type Org, type Role, type RuleError, ruleError } from "./model.ts";
import { validatePolicy } from "./policy.ts";

// An organization's own roles: a ranked list (highest first) the organization may extend,
// reorder and trim through governance. Same limits as the organization contract's `SetRoles`.

export const MAX_ROLES = 8;
const ROLE_ID = /^[a-z][a-z0-9_]{0,31}$/;

/** "Head coach" → "head_coach"; null when nothing usable is left. */
export function roleIdFromName(name: string): string | null {
	const id = name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "")
		.slice(0, 32);
	return ROLE_ID.test(id) ? id : null;
}

/** A role the templates don't know, labeled from its id: "head_coach" → "Head coach". */
export function customRole(id: string): Role {
	const words = id.replace(/_/g, " ");
	const name = words.charAt(0).toUpperCase() + words.slice(1);
	return { id, name, plural: plural(name) };
}

/** English plural for role names: coach → coaches, secretary → secretaries, member → members. */
function plural(name: string): string {
	if (/(s|x|z|ch|sh)$/.test(name)) return `${name}es`;
	if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
	return `${name}s`;
}

/** Whether `roles` may replace the organization's roles; the reason in plain words if not. */
export function validateRoles(org: Org, roles: readonly Role[]): Result<void, RuleError> {
	const ids = roles.map((role) => role.id);
	if (ids.length === 0 || ids.length > MAX_ROLES) {
		return err(ruleError("invalid-roles", `An organization has one to ${MAX_ROLES} roles.`));
	}
	if (new Set(ids).size !== ids.length || ids.some((id) => !ROLE_ID.test(id))) {
		return err(ruleError("invalid-roles", "Every role needs its own name of letters or digits."));
	}
	const held = org.members.find((member) => !ids.includes(member.roleId));
	if (held) {
		return err(
			ruleError(
				"role-in-use",
				"Someone still holds a role you're removing. Give them another role first.",
			),
		);
	}
	const valid = validatePolicy(org.policy, roles);
	if (!valid.ok) {
		return err(
			ruleError(
				"unknown-role",
				"The approval rules still ask for a role you're removing. Change the tiers first.",
			),
		);
	}
	return ok(undefined);
}
