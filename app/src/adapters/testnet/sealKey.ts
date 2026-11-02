import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { readDeviceBytes, writeDeviceBytes } from "./deviceStore.ts";

// The quantum-safe seal key (ML-DSA-44, FIPS 204) lives on the approving device: its 32-byte
// seed is kept in this browser's IndexedDB, one per person, and never leaves the device. The
// organization contract holds only the public key and checks each seal against it.

export const SEAL_KEY_DATABASE = "ancora-seal";

export type DeviceSealKey = {
	publicKey: Uint8Array;
	sign: (message: Uint8Array) => Uint8Array;
};

function fromSeed(seed: Uint8Array): DeviceSealKey {
	const { publicKey, secretKey } = ml_dsa44.keygen(seed);
	return { publicKey, sign: (message) => ml_dsa44.sign(message, secretKey) };
}

/** This device's seal key for the person, if one was created here. */
export async function loadSealKey(personId: string): Promise<DeviceSealKey | null> {
	const seed = await readDeviceBytes(SEAL_KEY_DATABASE, personId);
	return seed ? fromSeed(seed) : null;
}

/** Creates (or keeps) this device's seal key for the person. */
export async function createSealKey(personId: string): Promise<DeviceSealKey> {
	const existing = await loadSealKey(personId);
	if (existing) return existing;
	const seed = crypto.getRandomValues(new Uint8Array(32));
	await writeDeviceBytes(SEAL_KEY_DATABASE, personId, seed);
	return fromSeed(seed);
}

export const toHex = (bytes: Uint8Array) =>
	[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
