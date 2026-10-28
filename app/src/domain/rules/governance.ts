import type { Cents, Currency } from "../money.ts";
import { err, ok, type Result } from "../result.ts";
import { canBeSatisfied, rankOf } from "./approvals.ts";
import {
	type Asset,
	type Member,
	type Org,
	type PersonId,
	type Policy,
	type Role,
	type RoleId,
	type RuleError,
	ruleError,
	type TemplateId,
} from "./model.ts";
import { strictestTier, validatePolicy } from "./policy.ts";
import { validateRoles } from "./roles.ts";
import { templates } from "./templates.ts";

export type GovernanceChange =
	| { type: "addMember"; personId: PersonId; roleId: RoleId }
	| { type: "removeMember"; personId: PersonId }
	| { type: "changeRole"; personId: PersonId; roleId: RoleId }
	| { type: "updatePolicy"; policy: Policy }
	| { type: "switchTemplate"; templateId: TemplateId }
	| { type: "addAsset"; asset: Asset }
	| { type: "removeAsset"; token: string }
	/** Amount 0 removes the limit. */
	| { type: "setSpendingLimit"; personId: PersonId; amount: Cents; periodSeconds: number }
	/** The organization's own roles, highest first (add, reorder, drop roles nobody holds). */
	| { type: "setRoles"; roles: readonly Role[] };

export type NewOrgInput = {
	id: string;
	name: string;
	templateId: TemplateId;
	founderId: PersonId;
	founderRoleId: RoleId;
	baseCurrency: Currency;
	assets: readonly Asset[];
};

export function createOrg(input: NewOrgInput): Result<Org, RuleError> {
	const template = templates[input.templateId];
	if (!template.roles.some((role) => role.id === input.founderRoleId)) {
		return err(ruleError("unknown-role", "Pick one of this template's roles for yourself."));
	}
	if (input.assets.length === 0) {
		return err(ruleError("unknown-asset", "Pick at least one asset the organization accepts."));
	}
	return ok({
		id: input.id,
		name: input.name,
		templateId: template.id,
		roles: template.roles,
		members: [{ personId: input.founderId, roleId: input.founderRoleId }],
		policy: template.policy,
		founderId: input.founderId,
		baseCurrency: input.baseCurrency,
		assets: input.assets,
	});
}

/**
 * Setup phase: nobody besides the founder could satisfy the strictest tier, so requests could
 * never complete. Mirrors choosing the initial signers when the account is created.
 */
export function isSetupPhase(org: Org): boolean {
	return !canBeSatisfied(org, strictestTier(org.policy).approvals, [org.founderId]);
}

/** During the setup phase the founder changes members and rules directly, without a request. */
export function applyChangeDirectly(
	org: Org,
	actorId: PersonId,
	change: GovernanceChange,
): Result<Org, RuleError> {
	if (actorId !== org.founderId || !isSetupPhase(org)) {
		return err(
			ruleError(
				"not-in-setup-phase",
				"This change needs approval now that your organization has enough people. Create a request instead.",
			),
		);
	}
	return applyChange(org, change);
}

/** Applies an approved change. Refuses changes that would leave the rules impossible to satisfy. */
export function applyChange(org: Org, change: GovernanceChange): Result<Org, RuleError> {
	const next = nextOrg(org, change);
	if (!next.ok) return next;
	const strictest = (o: Org) => strictestTier(o.policy).approvals;
	if (canBeSatisfied(org, strictest(org)) && !canBeSatisfied(next.value, strictest(next.value))) {
		return err(
			ruleError(
				"would-lock-account",
				"After this change, nobody could approve large payments or changes anymore. Add someone with the required role first.",
			),
		);
	}
	return next;
}

function nextOrg(org: Org, change: GovernanceChange): Result<Org, RuleError> {
	const isMember = (personId: PersonId) => org.members.some((m) => m.personId === personId);
	const hasRole = (roleId: RoleId) => org.roles.some((role) => role.id === roleId);
	const notMember = err(ruleError("not-a-member", "This person isn't part of the organization."));
	const unknownRole = err(ruleError("unknown-role", "Pick one of the organization's roles."));

	switch (change.type) {
		case "addMember":
			if (isMember(change.personId)) {
				return err(
					ruleError("already-a-member", "This person is already part of the organization."),
				);
			}
			if (!hasRole(change.roleId)) return unknownRole;
			return ok(
				withMembers(org, [...org.members, { personId: change.personId, roleId: change.roleId }]),
			);
		case "removeMember":
			if (!isMember(change.personId)) return notMember;
			return ok(
				withMembers(
					org,
					org.members.filter((m) => m.personId !== change.personId),
				),
			);
		case "changeRole":
			if (!isMember(change.personId)) return notMember;
			if (!hasRole(change.roleId)) return unknownRole;
			return ok(
				withMembers(
					org,
					org.members.map((m) =>
						m.personId === change.personId ? { ...m, roleId: change.roleId } : m,
					),
				),
			);
		case "updatePolicy": {
			const valid = validatePolicy(change.policy, org.roles);
			return valid.ok ? ok({ ...org, policy: valid.value }) : valid;
		}
		case "switchTemplate":
			return ok(switchTemplate(org, change.templateId));
		case "setRoles": {
			const valid = validateRoles(org, change.roles);
			return valid.ok ? ok({ ...org, roles: [...change.roles] }) : valid;
		}
		case "addAsset":
			if (org.assets.some((a) => a.token === change.asset.token)) {
				return err(ruleError("asset-exists", "The organization already accepts this asset."));
			}
			return ok({ ...org, assets: [...org.assets, change.asset] });
		case "removeAsset":
			if (!org.assets.some((a) => a.token === change.token)) {
				return err(ruleError("unknown-asset", "This organization doesn't hold that asset."));
			}
			if (org.assets.length === 1) {
				return err(ruleError("last-asset", "An organization has to accept at least one asset."));
			}
			return ok({ ...org, assets: org.assets.filter((a) => a.token !== change.token) });
		case "setSpendingLimit":
			if (!isMember(change.personId)) return notMember;
			if (change.amount < 0 || (change.amount > 0 && change.periodSeconds <= 0)) {
				return err(
					ruleError("invalid-limit", "A spending limit needs an amount above zero and a period."),
				);
			}
			return ok(
				withMembers(
					org,
					org.members.map((m) => {
						if (m.personId !== change.personId) return m;
						if (change.amount === 0) return { personId: m.personId, roleId: m.roleId };
						return {
							...m,
							limit: {
								amount: change.amount,
								periodSeconds: change.periodSeconds,
								spent: 0,
								windowStart: 0,
							},
						};
					}),
				),
			);
	}
}

/**
 * Moves the org onto another template's roles and default rules. Members keep their rank
 * (highest role → highest role, ...), clamped to the lowest role, so nobody silently loses access.
 */
export function switchTemplate(org: Org, templateId: TemplateId): Org {
	const template = templates[templateId];
	const lowest = template.roles.length - 1;
	const members: Member[] = org.members.map((member) => {
		const role = template.roles[Math.min(rankOf(org, member.roleId), lowest)];
		// Templates always define at least one role, so the clamped index exists.
		return { personId: member.personId, roleId: role ? role.id : member.roleId };
	});
	return { ...org, templateId, roles: template.roles, policy: template.policy, members };
}

function withMembers(org: Org, members: readonly Member[]): Org {
	return { ...org, members };
}
