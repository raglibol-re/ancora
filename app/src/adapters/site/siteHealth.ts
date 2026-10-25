import type { SiteHealth } from "../../features/workspace/resolveDataSource.ts";

const TIMEOUT_MS = 4_000;

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
