import { StrKey } from "@stellar/stellar-sdk";
import type { DataSource } from "../../domain/dataSource.ts";
import type { PayeeLabel } from "../../domain/privateNote.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import { rulesHash } from "../../domain/rules/policyDocument.ts";
import { templates } from "../../domain/rules/templates.ts";
import type { CommandDeps } from "./commandDeps.ts";
import { createdId } from "./createdItem.ts";
import { uploadImage } from "./imageUpload.ts";
import { checkRecipient } from "./recipientCheck.ts";
import { address, changeToScVal, i128, optionalSymbol, text, toStroops, u32, u64 } from "./scv.ts";
import { inspectToken } from "./tokenInspect.ts";

// What an organization does besides its requests: founding, changes to members and rules, the
// Reserve, its picture, recipients, payment links, standing orders and test money.

export type OrganizationCommands = Pick<
	DataSource,
	| "createOrganization"
	| "proposeChange"
	| "moveToReserve"
	| "withdrawFromReserve"
	| "setLogo"
	| "savePayee"
	| "removePayee"
	| "createLink"
	| "closeLink"
	| "setStandingOrder"
	| "cancelStandingOrder"
	| "runStandingOrder"
	| "addTestMoney"
	| "canReceive"
	| "inspectToken"
>;

type Deps = CommandDeps & {
	/** A recipient's name and note as stored: encrypted when the organization keeps them private. */
	protectLabel: (
		orgId: string,
		actorId: PersonId,
		subject: string,
		label: PayeeLabel,
	) => Promise<Result<PayeeLabel, RuleError>>;
};

export function createOrganizationCommands(deps: Deps): OrganizationCommands {
	const { config, invoke, failed } = deps;

	/** A call to one of ancora's routes that changes the chain; the workspace is read again. */
	const sendThroughServer = async (path: string, body: Record<string, unknown>) => {
		const response = await deps.post(path, body);
		if (!response.ok) return response;
		await deps.refresh();
		return ok(undefined);
	};

	return {
		createOrganization: async (input) => {
			const founder = deps.me();
			if (!founder) return failed("Sign in first.");
			const template = templates[input.templateId];
			const policyHash = await rulesHash(
				template.id,
				template.roles,
				template.policy,
				input.baseCurrency,
			);
			const response = await deps.post<{ contractId: string }>("/api/create-organization", {
				founder,
				founderRole: input.founderRoleId,
				template: input.templateId,
				name: input.name.trim(),
				policyHash,
				baseCurrency: input.baseCurrency,
				assets: input.assets,
			});
			if (!response.ok) return response;
			await deps.refresh();
			return ok(response.value.contractId);
		},

		proposeChange: async (orgId, actorId, change) => {
			const account = deps.account(orgId);
			if (!account) return failed("This organization doesn't exist anymore. Reload the page.");
			if (change.type === "addMember" && !StrKey.isValidContract(change.personId.trim())) {
				return failed("Enter the person's ancora ID (their account address, starts with C).");
			}
			// Rule and role changes carry the fingerprint of the rules document they leave behind.
			const policyHash =
				change.type === "updatePolicy"
					? await rulesHash(
							account.org.templateId,
							account.org.roles,
							change.policy,
							account.org.baseCurrency,
						)
					: change.type === "setRoles"
						? await rulesHash(
								account.org.templateId,
								change.roles,
								account.org.policy,
								account.org.baseCurrency,
							)
						: undefined;
			const encoded = changeToScVal(
				change.type === "addMember" ? { ...change, personId: change.personId.trim() } : change,
				policyHash,
			);
			if (!encoded) return failed("Switching templates isn't available on Stellar yet.");
			const direct = account.onchain?.setupPhase && account.org.founderId === actorId;
			const result = await invoke(orgId, direct ? "change_directly" : "propose_change", [
				address(actorId),
				encoded,
			]);
			return result.ok ? ok(direct ? "applied" : "requested") : result;
		},

		moveToReserve: (orgId, actorId, token, amount) =>
			invoke(orgId, "move_to_reserve", [address(actorId), address(token), i128(toStroops(amount))]),

		withdrawFromReserve: (orgId, actorId, token, amount) =>
			invoke(orgId, "withdraw_from_reserve", [
				address(actorId),
				address(token),
				i128(toStroops(amount)),
			]),

		/** Stores the image in ancora's image store, then writes its URL on the organization. */
		setLogo: async (orgId, actorId, logoDataUrl) => {
			const image = await fetch(logoDataUrl).then((r) => r.blob());
			const uploaded = await uploadImage(image);
			if (!uploaded.ok) return uploaded;
			return invoke(orgId, "set_logo", [address(actorId), text(uploaded.value)]);
		},

		savePayee: async (orgId, actorId, payee) => {
			const to = payee.account.trim();
			if (!StrKey.isValidContract(to) && !StrKey.isValidEd25519PublicKey(to)) {
				return failed("Enter a Stellar address (starts with G or C).");
			}
			const stored = await deps.protectLabel(orgId, actorId, to, {
				name: payee.name.trim(),
				note: payee.note.trim(),
			});
			if (!stored.ok) return stored;
			return invoke(orgId, "set_payee", [
				address(actorId),
				address(to),
				text(stored.value.name),
				text(stored.value.note),
			]);
		},

		removePayee: (orgId, actorId, account) =>
			invoke(orgId, "remove_payee", [address(actorId), address(account)]),

		createLink: async (orgId, actorId, input) => {
			const linkIds = () => (deps.account(orgId)?.paymentLinks ?? []).map((link) => link.id);
			const before = linkIds();
			const result = await invoke(orgId, "create_link", [
				address(actorId),
				address(input.token),
				i128(toStroops(input.amount)),
				text(input.note.trim()),
				u32(input.maxPayments),
			]);
			if (!result.ok) return result;
			return ok(await createdId(linkIds, before, deps.refresh));
		},

		closeLink: (orgId, actorId, linkId) =>
			invoke(orgId, "close_link", [address(actorId), u64(Number(linkId))]),

		setStandingOrder: async (orgId, actorId, input) => {
			const note = await deps.protectNote(orgId, actorId, input.note.trim(), true);
			if (!note.ok) return note;
			return invoke(orgId, "set_standing_order", [
				address(actorId),
				address(input.token),
				address(input.to.trim()),
				i128(toStroops(input.amount)),
				text(note.value),
				optionalSymbol(input.category ?? null),
				u64(input.intervalSeconds),
				u64(Math.floor(input.firstAt / 1000)),
			]);
		},

		cancelStandingOrder: (orgId, actorId, orderId) =>
			invoke(orgId, "cancel_standing_order", [address(actorId), u64(Number(orderId))]),

		runStandingOrder: (orgId, orderId) =>
			sendThroughServer("/api/due", { organization: orgId, orderId: Number(orderId) }),

		addTestMoney: (orgId, _actorId, token) =>
			sendThroughServer("/api/test-money", { contractId: orgId, token }),

		canReceive: (token, recipient) => checkRecipient(config, token, recipient.trim()),

		inspectToken: (reference) => inspectToken(config, reference),
	};
}
