import { x25519 } from "@noble/curves/ed25519.js";
import { formatPrivateNote, parsePrivateNote } from "../../domain/privateNote.ts";

// The cryptography behind private details. An organization key (32 random bytes per epoch)
// encrypts notes with AES-256-GCM. It reaches each member wrapped to their X25519 public key:
// a fresh ephemeral key agrees a secret with theirs, HKDF-SHA256 turns it into an AES key, and
// that encrypts the organization key. Wrapped = ephemeral public key ‖ nonce ‖ ciphertext.

const WRAP_INFO = new TextEncoder().encode("ancora/keyring/v1");
const NONCE_BYTES = 12;

export type KeyPair = { secretKey: Uint8Array; publicKey: Uint8Array };

export function newKeyPair(): KeyPair {
	return x25519.keygen();
}

export function publicKeyOf(secretKey: Uint8Array): Uint8Array {
	return x25519.getPublicKey(secretKey);
}

export function newOrganizationKey(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(32));
}

/** WebCrypto takes bytes backed by a plain ArrayBuffer; noble's may be views of other buffers. */
const own = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(bytes);

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", own(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function wrappingKey(shared: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey("raw", own(shared), "HKDF", false, ["deriveKey"]);
	return crypto.subtle.deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt: own(salt), info: WRAP_INFO },
		base,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

const concat = (...parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
};

/** The organization key, readable only with the secret key behind `recipientPublic`. */
export async function wrapKey(
	organizationKey: Uint8Array,
	recipientPublic: Uint8Array,
): Promise<Uint8Array> {
	const ephemeral = x25519.keygen();
	const shared = x25519.getSharedSecret(ephemeral.secretKey, recipientPublic);
	const key = await wrappingKey(shared, ephemeral.publicKey);
	const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, own(organizationKey)),
	);
	return concat(ephemeral.publicKey, nonce, sealed);
}

export async function unwrapKey(wrapped: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
	const ephemeralPublic = wrapped.slice(0, 32);
	const nonce = wrapped.slice(32, 32 + NONCE_BYTES);
	const sealed = wrapped.slice(32 + NONCE_BYTES);
	const shared = x25519.getSharedSecret(secretKey, ephemeralPublic);
	const key = await wrappingKey(shared, ephemeralPublic);
	return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, sealed));
}

const toBase64Url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");

const fromBase64Url = (text: string) =>
	Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

/** `text` encrypted with the organization key of `epoch`, in the on-chain note format. */
export async function encryptNote(
	text: string,
	organizationKey: Uint8Array,
	epoch: number,
): Promise<string> {
	const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: nonce },
			await aesKey(organizationKey),
			new TextEncoder().encode(text),
		),
	);
	return formatPrivateNote(epoch, toBase64Url(concat(nonce, sealed)));
}

/** The plain text of a private note, or null without the key of its epoch (or if tampered). */
export async function decryptNote(
	note: string,
	keys: ReadonlyMap<number, Uint8Array>,
): Promise<string | null> {
	const parsed = parsePrivateNote(note);
	const key = parsed ? keys.get(parsed.epoch) : undefined;
	if (!parsed || !key) return null;
	try {
		const bytes = fromBase64Url(parsed.payload);
		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: bytes.slice(0, NONCE_BYTES) },
			await aesKey(key),
			bytes.slice(NONCE_BYTES),
		);
		return new TextDecoder().decode(plain);
	} catch {
		// A note that doesn't decrypt (wrong key, altered text) is shown as unreadable.
		return null;
	}
}
