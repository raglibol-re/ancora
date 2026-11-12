import { StrKey } from "@stellar/stellar-sdk";
import type { DataSource } from "../../domain/dataSource.ts";
import { ok } from "../../domain/result.ts";
import type { CommandDeps } from "./commandDeps.ts";
import { sealWithDeviceKey } from "./continuitySupport.ts";
import { createdId } from "./createdItem.ts";
import { mapAsset, mapRequest } from "./mapOrganization.ts";
import { readContract } from "./readContract.ts";
import { checkRecipient } from "./recipientCheck.ts";
import {
	address,
	batchLinesToScVal,
	bool,
	i128,
	optionalSymbol,
	text,
	toStroops,
	u64,
} from "./scv.ts";

// A request's life on the organization contract: asked for, approved or sealed, declined, held
// for a handover, and sent once it is due.

export type RequestCommands = Pick<
	DataSource,
	| "requestPayment"
	| "requestBatch"
	| "approve"
	| "seal"
	| "decline"
	| "confirmEscrow"
	| "cancelEscrow"
	| "escrowOf"
	| "executeRequest"
>;

const isAddress = (value: string) =>
	StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);

export function createRequestCommands(deps: CommandDeps): RequestCommands {
	const { config, invoke, failed } = deps;

	const requestIds = (orgId: string) =>
		(deps.account(orgId)?.requests ?? []).map((request) => request.id);

	/** A member's answer to a request: the contract call takes who answers and which request. */
	const answer = (fn: string) => (orgId: string, requestId: string, actorId: string) =>
		invoke(orgId, fn, [address(actorId), u64(Number(requestId))]);

	return {
		requestPayment: async (orgId, actorId, input) => {
			const to = "id" in input.payee ? input.payee.id : input.payee.account.trim();
			if (!isAddress(to)) {
				return failed("Enter the recipient's Stellar address (starts with G or C).");
			}
			const recipient = await checkRecipient(config, input.token, to).catch((error: unknown) => {
				// The check is a courtesy; if the RPC hiccups the contract still decides.
				deps.recordFailure("recipient check", error);
				return null;
			});
			if (recipient && !recipient.ok) return recipient;
			const note = await deps.protectNote(orgId, actorId, input.note.trim(), true);
			if (!note.ok) return note;
			const before = requestIds(orgId);
			const result = await invoke(orgId, "propose_payment", [
				address(actorId),
				address(input.token),
				address(to),
				i128(toStroops(input.amount)),
				text(note.value),
				optionalSymbol(input.category ?? null),
				bool(input.escrow ?? false),
			]);
			if (!result.ok) return result;
			return ok(await createdId(() => requestIds(orgId), before, deps.refresh));
		},

		requestBatch: async (orgId, actorId, input) => {
			const lines = input.lines.map((line) => ({
				to: ("id" in line.payee ? line.payee.id : line.payee.account).trim(),
				amount: line.amount,
				note: line.note.trim(),
			}));
			const bad = lines.find((line) => !isAddress(line.to));
			if (bad) return failed(`"${bad.to || "(empty)"}" isn't a Stellar address (G… or C…).`);
			// Every recipient must be able to take the asset, or the whole batch fails at payout.
			const checks = await Promise.all(
				[...new Set(lines.map((line) => line.to))].map((to) =>
					checkRecipient(config, input.token, to).catch(() => null),
				),
			);
			const refused = checks.find((check) => check && !check.ok);
			if (refused && !refused.ok) return refused;
			const notes = await Promise.all(
				[input.note.trim(), ...lines.map((line) => line.note)].map((note) =>
					deps.protectNote(orgId, actorId, note, true),
				),
			);
			const failedNote = notes.find((note) => !note.ok);
			if (failedNote && !failedNote.ok) return failedNote;
			const stored = notes.map((note) => (note.ok ? note.value : ""));
			const before = requestIds(orgId);
			const result = await invoke(orgId, "propose_batch", [
				address(actorId),
				address(input.token),
				batchLinesToScVal(lines.map((line, index) => ({ ...line, note: stored[index + 1] ?? "" }))),
				text(stored[0] ?? ""),
				optionalSymbol(input.category ?? null),
			]);
			if (!result.ok) return result;
			return ok(await createdId(() => requestIds(orgId), before, deps.refresh));
		},

		approve: answer("approve"),
		decline: answer("decline"),
		confirmEscrow: answer("confirm_escrow"),
		cancelEscrow: answer("cancel_escrow"),

		seal: (orgId, requestId, actorId) => {
			// Organizations that named an ML-DSA verifier take seals signed by the device key only.
			if (deps.account(orgId)?.org.sealVerifier) {
				return sealWithDeviceKey(
					{ network: config, invoke, failed },
					orgId,
					Number(requestId),
					actorId,
				);
			}
			return answer("seal")(orgId, requestId, actorId);
		},

		/** Reads one organization's request directly, so a recipient needs no membership. */
		escrowOf: async (orgId, requestId) => {
			try {
				const id = u64(Number(requestId));
				const [info, native, assets, state] = await Promise.all([
					readContract(config, orgId, "info") as Promise<Record<string, unknown>>,
					readContract(config, orgId, "request", [id]) as Promise<Record<string, unknown>>,
					readContract(config, orgId, "assets") as Promise<Record<string, unknown>[]>,
					readContract(config, orgId, "escrow", [id]) as Promise<Record<string, unknown>>,
				]);
				const symbols = new Map(deps.availableAssets.map((a) => [a.token, a.symbol]));
				const mapped = assets.map((a) =>
					mapAsset(a, (token, onchain) => symbols.get(token) ?? onchain),
				);
				const request = mapRequest(native, Date.now(), mapped, state);
				if (request.kind !== "payment" || !request.escrow) {
					return failed("This request isn't a held handover. Check the link.");
				}
				return ok({ orgName: String(info.name), currency: request.currency, request });
			} catch (error) {
				return failed(
					error instanceof Error
						? `This handover couldn't be read. ${error.message}`
						: "This handover couldn't be read.",
				);
			}
		},

		executeRequest: async (orgId, requestId) => {
			const response = await deps.post("/api/due", {
				organization: orgId,
				requestId: Number(requestId),
			});
			if (!response.ok) return response;
			await deps.refresh();
			return ok(undefined);
		},
	};
}
