import type { DataSourceKind } from "../../domain/dataSource.ts";

/** Site-wide default set by the demo admin. */
export type DemoMode = "sample" | "testnet";

/** What this browser asked for: follow the site default, or force one source. */
export type SourcePreference = "auto" | DataSourceKind;

/** Answer from /api/health, or "unreachable" when ancora's own server doesn't answer. */
export type SiteHealth = { mode: DemoMode; rpcOk: boolean } | "unreachable";

export type Resolution = {
	effective: DataSourceKind;
	/** Why the person is seeing sample data although the testnet was wanted; null otherwise. */
	fallbackReason: string | null;
	demoMode: DemoMode | null;
};

/**
 * Picks the data source. Sample data never waits for the network; the testnet is used only when
 * this build has its configuration and the site reports the Stellar RPC as reachable, and
 * otherwise falls back to sample data with a reason the banner can show.
 * Returns null while the site health is still unknown and the answer depends on it.
 */
export function resolveDataSource(
	preference: SourcePreference,
	health: SiteHealth | null,
	testnetAvailable: boolean,
): Resolution | null {
	if (preference === "sample") {
		return { effective: "sample", fallbackReason: null, demoMode: demoModeOf(health) };
	}
	if (health === null) return null;
	const demoMode = demoModeOf(health);
	const wanted = preference === "auto" ? (demoMode ?? "sample") : preference;
	if (wanted === "sample") return { effective: "sample", fallbackReason: null, demoMode };

	const fallback = (reason: string): Resolution => ({
		effective: "sample",
		fallbackReason: reason,
		demoMode,
	});
	if (!testnetAvailable) return fallback("This build has no Stellar testnet configuration.");
	if (health === "unreachable") {
		return fallback("ancora's server is unreachable right now, and it sponsors the testnet fees.");
	}
	if (!health.rpcOk) return fallback("The Stellar testnet is unreachable right now.");
	return { effective: "testnet", fallbackReason: null, demoMode };
}

function demoModeOf(health: SiteHealth | null): DemoMode | null {
	return health === null || health === "unreachable" ? null : health.mode;
}
