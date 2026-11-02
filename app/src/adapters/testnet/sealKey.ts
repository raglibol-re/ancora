import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";

// The quantum-safe seal key (ML-DSA-44, FIPS 204) lives on the approving device: its 32-byte
// seed is kept in this browser's IndexedDB, one per person, and never leaves the device. The
// organization contract holds only the public key and checks each seal against it.

const DB_NAME = "ancora-seal";
const STORE = "keys";

export class SealKeyStorageError extends Error {}

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(new SealKeyStorageError("This browser can't store a seal key (private window?)."));
	});
}

async function transact<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = run(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(new SealKeyStorageError("The seal key store didn't answer."));
		});
	} finally {
		db.close();
	}
}

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
	const seed = await transact<unknown>("readonly", (store) => store.get(personId));
	return seed instanceof Uint8Array ? fromSeed(seed) : null;
}

/** Creates (or keeps) this device's seal key for the person. */
export async function createSealKey(personId: string): Promise<DeviceSealKey> {
	const existing = await loadSealKey(personId);
	if (existing) return existing;
	const seed = crypto.getRandomValues(new Uint8Array(32));
	await transact("readwrite", (store) => store.put(seed, personId));
	return fromSeed(seed);
}

export const toHex = (bytes: Uint8Array) =>
	[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
