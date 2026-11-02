// Secrets that must stay on this device (seal keys, encryption keys), in IndexedDB: one
// database per kind, one object store, values keyed by person. Nothing here leaves the browser.

const STORE = "keys";

export class DeviceStoreError extends Error {}

function open(database: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(database, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(new DeviceStoreError("This browser can't store keys (private window?)."));
	});
}

async function transact<T>(
	database: string,
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await open(database);
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = run(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () =>
				reject(new DeviceStoreError("The key store on this device didn't answer."));
		});
	} finally {
		db.close();
	}
}

/** The bytes stored under `key`, if any. */
export async function readDeviceBytes(database: string, key: string): Promise<Uint8Array | null> {
	const value = await transact<unknown>(database, "readonly", (store) => store.get(key));
	return value instanceof Uint8Array ? value : null;
}

export async function writeDeviceBytes(database: string, key: string, value: Uint8Array) {
	await transact(database, "readwrite", (store) => store.put(value, key));
}
