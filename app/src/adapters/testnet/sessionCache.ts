import type { Workspace } from "../../domain/account.ts";
import type { Identity } from "../../domain/dataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import type { Profile } from "./organizationContract.ts";

// The last workspace this device saw, per signed-in pass. Shown at once on the next visit while
// the chain is read again, so nobody waits on the network to see their organizations. Reads are
// public data; signing still goes through the passkey, so a stale cache can't act.

const KEY = "ancora.testnet.session.v1";

export type CachedSession = {
	me: Identity;
	workspace: Workspace;
	profiles: [string, Profile | null][];
	savedAt: number;
};

export function loadCachedSession(storage: KeyValueStorage | null): CachedSession | null {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? "null");
		if (!parsed || typeof parsed !== "object") return null;
		const session = parsed as Partial<CachedSession>;
		if (
			typeof session.me?.id !== "string" ||
			!Array.isArray(session.workspace?.accounts) ||
			!Array.isArray(session.workspace?.people) ||
			!Array.isArray(session.profiles)
		) {
			return null;
		}
		return session as CachedSession;
	} catch {
		// Corrupt or blocked storage: start without a cache.
		return null;
	}
}

export function saveCachedSession(
	storage: KeyValueStorage | null,
	session: Omit<CachedSession, "savedAt">,
): void {
	try {
		storage?.setItem(KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
	} catch {
		// Full or blocked storage: the next visit simply reads the chain first.
	}
}

export function clearCachedSession(storage: KeyValueStorage | null): void {
	try {
		storage?.removeItem(KEY);
	} catch {
		// Nothing to clear.
	}
}
