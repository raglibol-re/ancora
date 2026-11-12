import type { OrgAccount } from "../../domain/account.ts";
import {
	type PayeeLabel,
	PRIVATE_PAYEE_NAME,
	privateNotesOf,
	revealNotes,
	revealPayees,
} from "../../domain/privateNote.ts";
import type { KeyringReads } from "./keyringReads.ts";
import { decryptNote } from "./privateCrypto.ts";
import { labelsFor } from "./privateLabels.ts";

/**
 * The private details this device could open so far: notes it decrypted and recipients' real
 * names. Accounts are kept and cached as stored (encrypted); this puts the readable text over
 * them for the screen only.
 */
export class RevealedDetails {
	private readonly plainNotes = new Map<string, string>();
	/** Notes already tried, so each is opened once per visit. */
	private readonly triedNotes = new Set<string>();
	/** Private recipients' names and notes, per organization. */
	private readonly payeeLabels = new Map<string, Map<string, PayeeLabel>>();
	private readonly keyring: () => KeyringReads | null;
	private readonly onFailure: (error: unknown) => void;

	/** `keyring` answers null where no keyring is configured: nothing is private there. */
	constructor(keyring: () => KeyringReads | null, onFailure: (error: unknown) => void) {
		this.keyring = keyring;
		this.onFailure = onFailure;
	}

	/** The account with the private notes and recipient labels this device opened so far. */
	reveal(account: OrgAccount): OrgAccount {
		return revealPayees(
			revealNotes(account, this.plainNotes),
			this.payeeLabels.get(account.org.id) ?? new Map(),
		);
	}

	/**
	 * Decrypts what `me` can read in these accounts; what can't be read stays "Private note".
	 * Answers whether anything new became readable.
	 */
	async open(accounts: readonly OrgAccount[], me: string): Promise<boolean> {
		const keyring = this.keyring();
		if (!keyring) return false;
		let revealed = false;
		for (const account of accounts) {
			const notes = privateNotesOf(account).filter((note) => !this.triedNotes.has(note));
			const privatePayees = account.payees.some((p) => p.name === PRIVATE_PAYEE_NAME);
			if (notes.length === 0 && !privatePayees) continue;
			try {
				const orgKeys = await keyring.keysFor(account.org.id, me);
				if (privatePayees) {
					this.payeeLabels.set(account.org.id, await labelsFor(keyring, account.org.id, orgKeys));
					revealed = true;
				}
				for (const note of notes) {
					this.triedNotes.add(note);
					const plain = await decryptNote(note, orgKeys);
					if (plain !== null) {
						this.plainNotes.set(note, plain);
						revealed = true;
					}
				}
			} catch (error) {
				this.onFailure(error);
			}
		}
		return revealed;
	}
}
