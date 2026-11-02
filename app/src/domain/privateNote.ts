import type { OrgAccount } from "./account.ts";

// Private details: references and discussion entries stored on-chain encrypted with the
// organization's key of an epoch, as "enc1:<epoch>:<base64url(nonce ‖ ciphertext ‖ tag)>".
// Only members holding that epoch's key read them; this module only knows the format.

export const PRIVATE_PREFIX = "enc1:";
/** On-chain references hold 140 characters. */
const MAX_STORED_LENGTH = 140;
/** AES-GCM nonce and tag around the text. */
const OVERHEAD_BYTES = 12 + 16;

export const UNREADABLE_NOTE = "Private note (not readable on this device)";

export function isPrivateNote(text: string): boolean {
	return text.startsWith(PRIVATE_PREFIX);
}

export function parsePrivateNote(text: string): { epoch: number; payload: string } | null {
	if (!isPrivateNote(text)) return null;
	const [epoch, payload] = text.slice(PRIVATE_PREFIX.length).split(":");
	const number = Number(epoch);
	return Number.isInteger(number) && number > 0 && payload ? { epoch: number, payload } : null;
}

export function formatPrivateNote(epoch: number, payload: string): string {
	return `${PRIVATE_PREFIX}${epoch}:${payload}`;
}

/** Whether `text` still fits an on-chain reference once encrypted for `epoch`. */
export function fitsPrivately(text: string, epoch: number): boolean {
	const bytes = new TextEncoder().encode(text).length;
	const encoded = Math.ceil(((OVERHEAD_BYTES + bytes) * 4) / 3);
	return PRIVATE_PREFIX.length + String(epoch).length + 1 + encoded <= MAX_STORED_LENGTH;
}

/**
 * The account with every private note replaced by its plain text where this device could read
 * it, and by a placeholder where it couldn't. `plain` maps stored notes to their text.
 */
export function revealNotes(account: OrgAccount, plain: ReadonlyMap<string, string>): OrgAccount {
	const reveal = (text: string) =>
		isPrivateNote(text) ? (plain.get(text) ?? UNREADABLE_NOTE) : text;
	return {
		...account,
		requests: account.requests.map((request) => {
			if (request.kind === "payment") return { ...request, note: reveal(request.note) };
			if (request.kind === "batch") {
				return {
					...request,
					note: reveal(request.note),
					lines: request.lines.map((line) => ({ ...line, note: reveal(line.note) })),
				};
			}
			return request;
		}),
		standingOrders:
			account.standingOrders?.map((order) => ({ ...order, memo: reveal(order.memo) })) ?? null,
		discussions: Object.fromEntries(
			Object.entries(account.discussions).map(([requestId, entries]) => [
				requestId,
				entries.map((entry) => ({ ...entry, text: reveal(entry.text) })),
			]),
		),
	};
}

/** Every private note in the account, to be decrypted before `revealNotes`. */
export function privateNotesOf(account: OrgAccount): string[] {
	const notes = new Set<string>();
	const add = (text: string) => {
		if (isPrivateNote(text)) notes.add(text);
	};
	for (const request of account.requests) {
		if (request.kind === "payment") add(request.note);
		if (request.kind === "batch") {
			add(request.note);
			for (const line of request.lines) add(line.note);
		}
	}
	for (const order of account.standingOrders ?? []) add(order.memo);
	for (const entries of Object.values(account.discussions)) {
		for (const entry of entries) add(entry.text);
	}
	return [...notes];
}

/** What members call a saved recipient, kept encrypted in the keyring when details are private. */
export type PayeeLabel = { name: string; note: string };

/** The name stored on-chain for a recipient whose real name is private. */
export const PRIVATE_PAYEE_NAME = "Private";
export const UNREADABLE_PAYEE = "Private recipient";

/** The account with private recipients' names and notes as this device could read them. */
export function revealPayees(
	account: OrgAccount,
	labels: ReadonlyMap<string, PayeeLabel>,
): OrgAccount {
	return {
		...account,
		payees: account.payees.map((payee) => {
			const label = labels.get(payee.account);
			if (label) return { ...payee, name: label.name, note: label.note };
			return payee.name === PRIVATE_PAYEE_NAME ? { ...payee, name: UNREADABLE_PAYEE } : payee;
		}),
	};
}
