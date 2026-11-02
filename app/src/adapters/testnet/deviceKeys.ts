import { readDeviceBytes, writeDeviceBytes } from "./deviceStore.ts";
import { PRIVATE_KEY_DATABASE } from "./privacySupport.ts";
import { SEAL_KEY_DATABASE } from "./sealKey.ts";

// A backup code for the keys that live only on this device: the encryption key for private
// details and the seed of the quantum-safe seal key. Entered on a new device it restores both,
// so private details read again and seals sign again without anyone re-sharing. It never moves
// money on its own (that still needs the person's passkey), but it reads their organizations'
// private details, so it is shown once and kept like a password.

const PREFIX = "ancora-keys-1.";
const KEY_BYTES = 32;
const CHECK_BYTES = 4;
const HAS_PRIVATE = 1;
const HAS_SEAL = 2;

export type DeviceSecrets = { privateKey: Uint8Array | null; sealSeed: Uint8Array | null };

export class BackupCodeError extends Error {}

const toBase64Url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");

const fromBase64Url = (text: string) =>
	Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

async function checksum(bytes: Uint8Array): Promise<Uint8Array> {
	const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
	return new Uint8Array(digest).slice(0, CHECK_BYTES);
}

export async function encodeBackupCode(secrets: DeviceSecrets): Promise<string> {
	const flags = (secrets.privateKey ? HAS_PRIVATE : 0) | (secrets.sealSeed ? HAS_SEAL : 0);
	const body = Uint8Array.from([flags, ...(secrets.privateKey ?? []), ...(secrets.sealSeed ?? [])]);
	return PREFIX + toBase64Url(Uint8Array.from([...body, ...(await checksum(body))]));
}

export async function decodeBackupCode(code: string): Promise<DeviceSecrets> {
	const trimmed = code.trim();
	if (!trimmed.startsWith(PREFIX)) {
		throw new BackupCodeError("This isn't an ancora backup code (it starts with ancora-keys-1.).");
	}
	let bytes: Uint8Array;
	try {
		bytes = fromBase64Url(trimmed.slice(PREFIX.length));
	} catch {
		throw new BackupCodeError("The backup code is damaged. Copy it again, in full.");
	}
	const body = bytes.slice(0, -CHECK_BYTES);
	const expected = await checksum(body);
	const flags = body[0] ?? 0;
	const length = 1 + (flags & HAS_PRIVATE ? KEY_BYTES : 0) + (flags & HAS_SEAL ? KEY_BYTES : 0);
	const intact = body.length === length && expected.every((b, i) => b === bytes[body.length + i]);
	if (!intact) throw new BackupCodeError("The backup code is damaged. Copy it again, in full.");
	let offset = 1;
	const take = (present: boolean) => {
		if (!present) return null;
		const part = body.slice(offset, offset + KEY_BYTES);
		offset += KEY_BYTES;
		return part;
	};
	return {
		privateKey: take((flags & HAS_PRIVATE) !== 0),
		sealSeed: take((flags & HAS_SEAL) !== 0),
	};
}

/** This device's secrets for the person, as a backup code; null when there are none. */
export async function exportDeviceKeys(personId: string): Promise<string | null> {
	const [privateKey, sealSeed] = await Promise.all([
		readDeviceBytes(PRIVATE_KEY_DATABASE, personId),
		readDeviceBytes(SEAL_KEY_DATABASE, personId),
	]);
	if (!privateKey && !sealSeed) return null;
	return encodeBackupCode({ privateKey, sealSeed });
}

/** Restores the person's secrets on this device from a backup code; says which came back. */
export async function importDeviceKeys(
	personId: string,
	code: string,
): Promise<{ privateKey: boolean; sealKey: boolean }> {
	const secrets = await decodeBackupCode(code);
	if (secrets.privateKey)
		await writeDeviceBytes(PRIVATE_KEY_DATABASE, personId, secrets.privateKey);
	if (secrets.sealSeed) await writeDeviceBytes(SEAL_KEY_DATABASE, personId, secrets.sealSeed);
	return { privateKey: secrets.privateKey !== null, sealKey: secrets.sealSeed !== null };
}
