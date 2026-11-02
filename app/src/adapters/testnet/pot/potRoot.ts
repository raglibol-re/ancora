import { Buffer } from "buffer";
import type { KeyringReads } from "../keyringReads.ts";
import { decryptNote, encryptNote } from "../privateCrypto.ts";

// The organization's pot root: 32 random bytes every pot key derives from, kept in the keyring
// as a label on the pot's address, encrypted with the organization's key like private details.
// Whoever reads private details (members, and auditors once shared) reads the pot; spending
// still needs the organization's rules, since only the organization can call the pot.

export type PotRoot = { root: Uint8Array; auditorId: number };

/** The root as the keyring holds it, opened with this person's keys; null if absent or unreadable. */
export async function readPotRoot(
	reads: KeyringReads,
	orgId: string,
	person: string,
	pot: string,
): Promise<PotRoot | null> {
	const [labels, keys] = await Promise.all([reads.labels(orgId), reads.keysFor(orgId, person)]);
	const sealed = labels.get(pot);
	if (!sealed) return null;
	const plain = await decryptNote(sealed, keys);
	if (plain === null) return null;
	try {
		const parsed = JSON.parse(plain) as { pot?: unknown; aud?: unknown };
		const root = Buffer.from(String(parsed.pot), "base64");
		return root.length === 32
			? { root: new Uint8Array(root), auditorId: Number(parsed.aud) }
			: null;
	} catch {
		// Not ancora's pot label: treated as no pot key.
		return null;
	}
}

/** The root sealed for the keyring with the organization's current key. */
export function sealPotRoot(potRoot: PotRoot, key: Uint8Array, epoch: number): Promise<string> {
	const plain = JSON.stringify({
		pot: Buffer.from(potRoot.root).toString("base64"),
		aud: potRoot.auditorId,
	});
	return encryptNote(plain, key, epoch);
}
