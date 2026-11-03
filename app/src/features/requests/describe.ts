import type { OrgAccount } from "../../domain/account.ts";
import type { Currency } from "../../domain/money.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { periodLabel } from "../../domain/rules/limits.ts";
import type { Asset, Evaluation, Requirement, Role, RoleId } from "../../domain/rules/model.ts";
import type { ApprovalRequest, PotRequest, RequestStatus } from "../../domain/rules/requests.ts";
import { templates } from "../../domain/rules/templates.ts";
import { formatMoney } from "../../ui/format.ts";
import { currentLanguage, msg, t } from "../../ui/i18n.ts";
import { describeDealAction } from "../deals/describeDealAction.ts";

// Plain-language copy for rules and requests. No crypto jargon.

type NameOf = (personId: string) => string;

/** An org or a template: anything that defines roles (and, for an org, assets and a currency). */
type HasRoles = { roles: readonly Role[]; assets?: readonly Asset[]; baseCurrency?: Currency };

export function roleLabel(org: HasRoles, roleId: RoleId, count = 1): string {
	const role = org.roles.find((r) => r.id === roleId);
	if (!role) return t("unknown role");
	return count === 1 ? t(role.name) : t(role.plural);
}

function joinWithAnd(parts: string[]): string {
	if (parts.length <= 1) return parts.join("");
	return t("{list} and {last}", { list: parts.slice(0, -1).join(", "), last: parts.at(-1) ?? "" });
}

export function describeRequirements(org: HasRoles, requirements: readonly Requirement[]): string {
	if (requirements.length === 0) return t("no approval");
	return joinWithAnd(requirements.map((r) => `${r.count} ${roleLabel(org, r.roleId, r.count)}`));
}

/** The live rule preview: "Needs 2 board members, then a 48-hour objection window." */
export function describeEvaluation(org: HasRoles, evaluation: Evaluation): string {
	const { approvals, objectionWindowHours, sealRequired } = evaluation;
	if (evaluation.withinLimit) {
		return t("Within the requester's spending limit. No approval needed, it goes out right away.");
	}
	const sentences: string[] = [];
	if (evaluation.overBudget) {
		sentences.push(t("Over its budget for this period, so the strictest tier applies."));
	}
	if (approvals.length === 0 && objectionWindowHours === 0) {
		sentences.push(t("No approval needed. It goes out right away."));
	} else if (approvals.length === 0) {
		sentences.push(
			t("No approval needed, then a {hours}-hour objection window.", {
				hours: objectionWindowHours,
			}),
		);
	} else {
		const needs = describeRequirements(org, approvals);
		sentences.push(
			objectionWindowHours > 0
				? t("Needs {approvals}, then a {hours}-hour objection window.", {
						approvals: needs,
						hours: objectionWindowHours,
					})
				: t("Needs {approvals}.", { approvals: needs }),
		);
	}
	if (sealRequired) sentences.push(t("The security seal is required."));
	return sentences.join(" ");
}

export function describeChange(org: HasRoles, change: GovernanceChange, nameOf: NameOf): string {
	switch (change.type) {
		case "addMember":
			return t("Add {name} as {role}", {
				name: nameOf(change.personId),
				role: roleLabel(org, change.roleId),
			});
		case "removeMember":
			return t("Remove {name}", { name: nameOf(change.personId) });
		case "changeRole":
			return t("Make {name} {role}", {
				name: nameOf(change.personId),
				role: roleLabel(org, change.roleId),
			});
		case "updatePolicy":
			return t("Update the approval rules");
		case "switchTemplate":
			return t("Switch to the {template} template", {
				// English writes the template name in lower case mid-sentence; German keeps its nouns capitalised.
				template:
					currentLanguage() === "en"
						? templates[change.templateId].label.toLowerCase()
						: t(templates[change.templateId].label),
			});
		case "addAsset":
			return t("Accept {asset}", { asset: change.asset.symbol });
		case "removeAsset":
			return t("Stop accepting {asset}", {
				asset: org.assets?.find((a) => a.token === change.token)?.symbol ?? t("an asset"),
			});
		case "setRoles":
			return t("Set the roles to {roles}", {
				roles: change.roles
					.map((role) => t(org.roles.find((r) => r.id === role.id)?.name ?? role.name))
					.join(", "),
			});
		case "upgrade":
			return t("Move to ancora release {version}", {
				version: change.version ?? change.wasmHash.slice(0, 12),
			});
		case "setAllowance": {
			const asset = org.assets?.find((a) => a.token === change.token);
			const scope = [
				asset ? t("in {asset}", { asset: asset.symbol }) : null,
				change.category ? t("for #{category}", { category: change.category }) : null,
			]
				.filter(Boolean)
				.join(" ");
			return change.amount === 0
				? t("Remove the allowance of {name} {scope}", {
						name: nameOf(change.personId),
						scope,
					})
				: t("Let {name} pay {amount} per {period} {scope} without approvals", {
						name: nameOf(change.personId),
						amount: formatMoney(change.amount, asset?.currency ?? org.baseCurrency ?? "EUR"),
						period: t(periodLabel(change.periodSeconds)),
						scope,
					});
		}
		case "setRecipients": {
			const count = change.rule.allowed.length;
			if (change.rule.mode === "open") return t("Pay any recipient under the normal rules");
			if (change.rule.mode === "only") {
				return count === 1
					? t("Pay only the 1 allowed recipient")
					: t("Pay only the {count} allowed recipients", { count });
			}
			return count === 1
				? t("Send payments outside the 1 allowed recipient to the strictest approvals")
				: t("Send payments outside the {count} allowed recipients to the strictest approvals", {
						count,
					});
		}
		case "setSuccessor":
			return change.successorId === null
				? t("Remove the successor of {name}", { name: nameOf(change.personId) })
				: t("Let {successor} take over from {name} after {days} quiet days", {
						successor: nameOf(change.successorId),
						name: nameOf(change.personId),
						days: Math.round(change.inactiveSeconds / 86_400),
					});
		case "setSealVerifier":
			return change.verifier
				? t("Seal large payments with quantum-safe keys")
				: t("Seal large payments with passkeys only");
		case "setFxOracle":
			return change.oracle
				? t("Use live exchange rates for payments in other currencies")
				: t("Stop using exchange rates; other currencies take the strictest approvals");
		case "setSpendingLimit":
			return change.amount === 0
				? t("Remove the spending limit of {name}", { name: nameOf(change.personId) })
				: t("Give {name} a spending limit of {amount} per {period}", {
						name: nameOf(change.personId),
						amount: formatMoney(change.amount, org.baseCurrency ?? "EUR"),
						period: t(periodLabel(change.periodSeconds)),
					});
	}
}

export function requestTitle(
	account: OrgAccount,
	request: ApprovalRequest,
	nameOf: NameOf,
): string {
	if (request.kind === "governance") return describeChange(account.org, request.change, nameOf);
	if (request.kind === "deal") {
		const title = describeDealAction(request.action, (_, milestone) =>
			t("milestone {number}", { number: milestone + 1 }),
		);
		const currency = account.org.assets.find((a) => a.token === request.reservedToken)?.currency;
		return request.reserved > 0 && currency
			? `${title} · ${formatMoney(request.reserved, currency)}`
			: title;
	}
	if (request.kind === "pot") return describePotRequest(request, nameOf);
	if (request.kind === "batch") {
		const count = request.lines.length;
		const amount = formatMoney(request.amount, request.currency);
		const title =
			count === 1
				? t("{amount} to 1 recipient", { amount })
				: t("{amount} to {count} recipients", { amount, count });
		return request.note ? `${title} · ${request.note}` : title;
	}
	const payee = account.payees.find((p) => p.id === request.recipientId);
	return t("{amount} to {recipient}", {
		amount: formatMoney(request.amount, request.currency),
		recipient: payee?.name ?? t("a recipient"),
	});
}

/** A confidential pot step in a line; a payment's amount stays private on the network. */
function describePotRequest(request: PotRequest, nameOf: NameOf): string {
	const { action } = request;
	switch (action.type) {
		case "register":
			return t("Open the confidential pot");
		case "deposit":
			return t("Move {amount} into the confidential pot", {
				amount: formatMoney(action.amount, request.currency),
			});
		case "withdraw":
			return t("Take {amount} out of the confidential pot", {
				amount: formatMoney(action.amount, request.currency),
			});
		case "pay":
			return t("Confidential payment to {name}", { name: nameOf(action.to) });
	}
}

export const statusLabels: Readonly<Record<RequestStatus, string>> = {
	pending: msg("Waiting for approval"),
	scheduled: msg("Objection window"),
	ready: msg("Ready to go out"),
	executed: msg("Done"),
	declined: msg("Declined"),
	failed: msg("Failed"),
	escrowed: msg("Held until both confirm"),
};
