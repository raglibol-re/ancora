import { Buffer } from "buffer";
import { fieldBytes } from "./potCurve.ts";
import type { PotKeys } from "./potKeys.ts";
import type { PotBalance } from "./potWallet.ts";

// Where this device last left the pot: both openings, the history and the ledger read up to,
// encrypted (AES-GCM, key derived from the pot's viewing key) in this browser's storage. The
// next read replays only the events after it, so a pot untouched for longer than the week of
// history the RPC keeps stays readable on any device that read it before. It is never trusted
// blindly: the replay from it must still reproduce the commitments on-chain.

export type PotSnapshot = { toLedger: number; balance: PotBalance };

const storageKey = (pot: string, org: string) => `ancora.pot.v1.${pot}.${org}`;

async function aesKey(keys: PotKeys): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey(
		"raw",
		Uint8Array.from(fieldBytes(keys.view)),
		"HKDF",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: new Uint8Array(),
			info: new TextEncoder().encode("ancora/pot/v1/snapshot"),
		},
		base,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

const toJson = (snapshot: PotSnapshot) =>
	JSON.stringify(snapshot, (_, value) => (typeof value === "bigint" ? `${value}n` : value));

const fromJson = (text: string): PotSnapshot =>
	JSON.parse(text, (_, value) =>
		typeof value === "string" && /^-?\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value,
	) as PotSnapshot;

/** This device's last snapshot of the pot; null when there is none or it can't be opened. */
export async function loadSnapshot(
	keys: PotKeys,
	pot: string,
	org: string,
): Promise<PotSnapshot | null> {
	let stored: string | null;
	try {
		stored = localStorage.getItem(storageKey(pot, org));
	} catch {
		// No storage (private window): read the pot from its history instead.
		return null;
	}
	if (!stored) return null;
	try {
		const bytes = Buffer.from(stored, "base64");
		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: bytes.subarray(0, 12) },
			await aesKey(keys),
			bytes.subarray(12),
		);
		return fromJson(new TextDecoder().decode(plain));
	} catch {
		// A snapshot from another pot key or a damaged one is ignored; the history decides.
		return null;
	}
}

export async function saveSnapshot(
	keys: PotKeys,
	pot: string,
	org: string,
	snapshot: PotSnapshot,
): Promise<void> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await aesKey(keys),
		new TextEncoder().encode(toJson(snapshot)),
	);
	try {
		localStorage.setItem(
			storageKey(pot, org),
			Buffer.from([...iv, ...new Uint8Array(sealed)]).toString("base64"),
		);
	} catch {
		// No storage: the next read replays the history again.
	}
}
