import type { OrgAccount } from "../../domain/account.ts";
import type { Currency } from "../../domain/money.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { periodLabel } from "../../domain/rules/limits.ts";
import type { Asset, Evaluation, Requirement, Role, RoleId } from "../../domain/rules/model.ts";
import type { ApprovalRequest, RequestStatus } from "../../domain/rules/requests.ts";
import { templates } from "../../domain/rules/templates.ts";
import { formatMoney } from "../../ui/format.ts";

// Plain-language copy for rules and requests. No crypto jargon.

type NameOf = (personId: string) => string;

/** An org or a template: anything that defines roles (and, for an org, assets and a currency). */
type HasRoles = { roles: readonly Role[]; assets?: readonly Asset[]; baseCurrency?: Currency };

export function roleLabel(org: HasRoles, roleId: RoleId, count = 1): string {
	const role = org.roles.find((r) => r.id === roleId);
	if (!role) return "unknown role";
	return count === 1 ? role.name : role.plural;
}

function joinWithAnd(parts: string[]): string {
	if (parts.length <= 1) return parts.join("");
	return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function describeRequirements(org: HasRoles, requirements: readonly Requirement[]): string {
	if (requirements.length === 0) return "no approval";
	return joinWithAnd(requirements.map((r) => `${r.count} ${roleLabel(org, r.roleId, r.count)}`));
}

/** The live rule preview: "Needs 2 board members, then a 48-hour objection window." */
export function describeEvaluation(org: HasRoles, evaluation: Evaluation): string {
	const { approvals, objectionWindowHours, sealRequired } = evaluation;
	if (evaluation.withinLimit) {
		return "Within the requester's spending limit. No approval needed, it goes out right away.";
	}
	const sentences: string[] = [];
	if (evaluation.overBudget) {
		sentences.push("Over its budget for this period, so the strictest tier applies.");
	}
	if (approvals.length === 0 && objectionWindowHours === 0) {
		sentences.push("No approval needed. It goes out right away.");
	} else {
		const needs =
			approvals.length === 0
				? "No approval needed"
				: `Needs ${describeRequirements(org, approvals)}`;
		sentences.push(
			objectionWindowHours > 0
				? `${needs}, then a ${objectionWindowHours}-hour objection window.`
				: `${needs}.`,
		);
	}
	if (sealRequired) sentences.push("The security seal is required.");
	return sentences.join(" ");
}

export function describeChange(org: HasRoles, change: GovernanceChange, nameOf: NameOf): string {
	switch (change.type) {
		case "addMember":
			return `Add ${nameOf(change.personId)} as ${roleLabel(org, change.roleId)}`;
		case "removeMember":
			return `Remove ${nameOf(change.personId)}`;
		case "changeRole":
			return `Make ${nameOf(change.personId)} ${roleLabel(org, change.roleId)}`;
		case "updatePolicy":
			return "Update the approval rules";
		case "switchTemplate":
			return `Switch to the ${templates[change.templateId].label.toLowerCase()} template`;
		case "addAsset":
			return `Accept ${change.asset.symbol}`;
		case "removeAsset":
			return `Stop accepting ${org.assets?.find((a) => a.token === change.token)?.symbol ?? "an asset"}`;
		case "setRoles":
			return `Set the roles to ${change.roles
				.map((role) => org.roles.find((r) => r.id === role.id)?.name ?? role.name)
				.join(", ")}`;
		case "setSpendingLimit":
			return change.amount === 0
				? `Remove the spending limit of ${nameOf(change.personId)}`
				: `Give ${nameOf(change.personId)} a spending limit of ${formatMoney(change.amount, org.baseCurrency ?? "EUR")} per ${periodLabel(change.periodSeconds)}`;
	}
}

export function requestTitle(
	account: OrgAccount,
	request: ApprovalRequest,
	nameOf: NameOf,
): string {
	if (request.kind === "governance") return describeChange(account.org, request.change, nameOf);
	const payee = account.payees.find((p) => p.id === request.recipientId);
	return `${formatMoney(request.amount, request.currency)} to ${payee?.name ?? "a recipient"}`;
}

export const statusLabels: Readonly<Record<RequestStatus, string>> = {
	pending: "Waiting for approval",
	scheduled: "Objection window",
	ready: "Ready to go out",
	executed: "Done",
	declined: "Declined",
	failed: "Failed",
	escrowed: "Held until both confirm",
};
