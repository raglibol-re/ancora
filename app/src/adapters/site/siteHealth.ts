import type { SiteHealth } from "../../features/workspace/resolveDataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";

const TIMEOUT_MS = 4_000;
const HEALTH_KEY = "ancora.health.v1";

/** The last health answer this device saw, so the app can start without waiting for the server. */
export function loadCachedHealth(storage: KeyValueStorage | null): SiteHealth | null {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(HEALTH_KEY) ?? "null");
		if (!parsed || typeof parsed !== "object") return null;
		const health = parsed as { mode?: unknown; rpcOk?: unknown };
		return (health.mode === "testnet" || health.mode === "sample") && health.rpcOk === true
			? { mode: health.mode, rpcOk: true }
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
			data?: { mode?: unknown; rpc?: { ok?: unknown } };
		};
		if (!body.success || !body.data) return "unreachable";
		return {
			mode: body.data.mode === "testnet" ? "testnet" : "sample",
			rpcOk: body.data.rpc?.ok === true,
		};
	} catch {
		// Network error or timeout: the caller treats the server as unreachable.
		return "unreachable";
	}
}
