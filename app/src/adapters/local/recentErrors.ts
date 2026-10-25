type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RecentError = { at: number; where: string; message: string };

const KEY = "ancora.errors.v1";
const MAX_ENTRIES = 20;

/** Last failed commands in this browser, newest first; the demo admin shows them. */
export function readRecentErrors(storage: KeyValueStorage | null): RecentError[] {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? "[]");
		return Array.isArray(parsed) ? (parsed as RecentError[]) : [];
	} catch {
		return [];
	}
}

export function recordError(storage: KeyValueStorage | null, entry: RecentError): void {
	try {
		const next = [entry, ...readRecentErrors(storage)].slice(0, MAX_ENTRIES);
		storage?.setItem(KEY, JSON.stringify(next));
	} catch {
		// Blocked or full storage: the error was already shown to the person; nothing else to do.
	}
}

export function clearRecentErrors(storage: KeyValueStorage | null): void {
	try {
		storage?.removeItem(KEY);
	} catch {
		// Blocked storage: nothing was stored in the first place.
	}
}
