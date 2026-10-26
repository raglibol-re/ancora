import type { SiteHealth } from "../../features/workspace/resolveDataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";

const TIMEOUT_MS = 4_000;
const HEALTH_KEY = "ancora.health.v1";

/** The last health answer this device saw, so the app can start without waiting for the server. */
export function loadCachedHealth(storage: KeyValueStorage | null): SiteHealth | null {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(HEALTH_KEY) ?? "null");
		if (!parsed || typeof parsed !== "object") return null;
		const health = parsed as { mode?: unknown; rpcOk?: unknown; testMoney?: unknown };
		return (health.mode === "testnet" || health.mode === "sample") && health.rpcOk === true
			? { mode: health.mode, rpcOk: true, testMoney: availabilityOf(health.testMoney) }
			: null;
	} catch {
		return null;
	}
}

export function saveCachedHealth(storage: KeyValueStorage | null, health: SiteHealth): void {
	try {
		if (health !== "unreachable" && health.rpcOk) {
			storage?.setItem(HEALTH_KEY, JSON.stringify(health));
		}
	} catch {
		// Blocked storage: the next start waits for the server as before.
	}
}

/** Asks ancora's own server for the site demo mode and whether the Stellar RPC answers. */
export async function fetchSiteHealth(): Promise<SiteHealth> {
	try {
		const response = await fetch("/api/health", {
			cache: "no-store",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const body = (await response.json()) as {
			success?: boolean;
			data?: { mode?: unknown; rpc?: { ok?: unknown }; testMoney?: unknown };
		};
		if (!body.success || !body.data) return "unreachable";
		return {
			mode: body.data.mode === "testnet" ? "testnet" : "sample",
			rpcOk: body.data.rpc?.ok === true,
			testMoney: availabilityOf(body.data.testMoney),
		};
	} catch {
		// Network error or timeout: the caller treats the server as unreachable.
		return "unreachable";
	}
}

/** The server's list (or the cache's record) of which assets have test money, by token. */
function availabilityOf(value: unknown): Record<string, boolean> {
	const record: Record<string, boolean> = {};
	if (Array.isArray(value)) {
		for (const entry of value) {
			const item = entry as { token?: unknown; available?: unknown };
			if (typeof item.token === "string" && typeof item.available === "boolean") {
				record[item.token] = item.available;
			}
		}
	} else if (value && typeof value === "object") {
		for (const [token, available] of Object.entries(value as Record<string, unknown>)) {
			if (typeof available === "boolean") record[token] = available;
		}
	}
	return record;
}
