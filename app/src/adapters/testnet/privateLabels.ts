import type { OrgAccount } from "../../domain/account.ts";
import {
	type PayeeLabel,
	PRIVATE_PAYEE_NAME,
	privateNotesOf,
	revealNotes,
	revealPayees,
} from "../../domain/privateNote.ts";
import type { PersonId } from "../../domain/rules/model.ts";
import type { KeyringReads } from "./keyringReads.ts";
import { decryptNote, encryptNote } from "./privateCrypto.ts";

// Private recipient names and notes (keyring labels), and the account as a person reads it:
// private notes and labels opened with the keys their device holds.

/** Label ciphertext the keyring accepts. */
const MAX_LABEL_BYTES = 512;

/** The decrypted labels of the organization's recipients, by address. */
export async function labelsFor(
	reads: KeyringReads,
	orgId: string,
	keys: ReadonlyMap<number, Uint8Array>,
): Promise<Map<string, PayeeLabel>> {
	const labels = new Map<string, PayeeLabel>();
	if (keys.size === 0) return labels;
	for (const [who, sealed] of await reads.labels(orgId)) {
		const plain = await decryptNote(sealed, keys);
		if (plain === null) continue;
		try {
			const parsed = JSON.parse(plain) as { n?: unknown; c?: unknown };
			labels.set(who, { name: String(parsed.n ?? ""), note: String(parsed.c ?? "") });
		} catch {
			// A label that isn't ancora's JSON is left out; the recipient shows as private.
		}
	}
	return labels;
}

/** A recipient's name and note encrypted for the keyring, and what goes on-chain instead. */
export async function sealLabel(
	label: PayeeLabel,
	key: Uint8Array,
	epoch: number,
): Promise<{ sealed: string; onChain: PayeeLabel } | null> {
	const sealed = await encryptNote(JSON.stringify({ n: label.name, c: label.note }), key, epoch);
	if (new TextEncoder().encode(sealed).length > MAX_LABEL_BYTES) return null;
	return { sealed, onChain: { name: PRIVATE_PAYEE_NAME, note: "" } };
}

/** The account with every private note and label this person's device can open, opened. */
export async function revealFor(
	reads: KeyringReads,
	account: OrgAccount,
	person: PersonId,
): Promise<OrgAccount> {
	const keys = await reads.keysFor(account.org.id, person);
	const plain = new Map<string, string>();
	for (const note of privateNotesOf(account)) {
		const text = await decryptNote(note, keys);
		if (text !== null) plain.set(note, text);
	}
	return revealPayees(revealNotes(account, plain), await labelsFor(reads, account.org.id, keys));
}
