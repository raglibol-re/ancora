import type { Asset, Member, Org, PersonId, RoleId, TemplateId } from "./model.ts";
import { templates } from "./templates.ts";

export const EURC: Asset = { token: "eurc", symbol: "EURC", currency: "EUR" };
export const USDC: Asset = { token: "usdc", symbol: "USDC", currency: "USD" };

/** Builds an org from a template with the given [person, role] pairs; the first person is the founder. */
export function orgWith(templateId: TemplateId, people: readonly [PersonId, RoleId][]): Org {
	const members: Member[] = people.map(([personId, roleId]) => ({ personId, roleId }));
	const template = templates[templateId];
	return {
		id: `org-${templateId}`,
		name: template.label,
		templateId,
		roles: template.roles,
		members,
		policy: template.policy,
		founderId: members[0]?.personId ?? "nobody",
		baseCurrency: "EUR",
		assets: [EURC, USDC],
	};
}

export const club = () =>
	orgWith("club", [
		["tess", "treasurer"],
		["bo", "board"],
		["bea", "board"],
		["max", "member"],
	]);

export const company = () =>
	orgWith("company", [
		["dana", "director"],
		["dirk", "director"],
		["fin", "finance"],
		["emil", "employee"],
	]);

export const team = () =>
	orgWith("team", [
		["lea", "lead"],
		["mo", "member"],
		["mia", "member"],
	]);
