import { get, put } from "@vercel/blob";

// The one piece of site-wide demo state: which data source visitors get by default. It lives in
// Vercel Blob (see docs/DECISIONS.md); everything else is on-chain or in the browser.

export type DemoMode = "sample" | "testnet";

export type DemoState = {
	mode: DemoMode;
	updatedAt: string | null;
};

const PATHNAME = "demo/state.json";
const DEFAULT_STATE: DemoState = { mode: "sample", updatedAt: null };

export function parseDemoState(value: unknown): DemoState {
	if (!value || typeof value !== "object") return DEFAULT_STATE;
	const { mode, updatedAt } = value as Partial<DemoState>;
	return {
		mode: mode === "testnet" ? "testnet" : "sample",
		updatedAt: typeof updatedAt === "string" ? updatedAt : null,
	};
}

export async function readDemoState(): Promise<DemoState> {
	try {
		const result = await get(PATHNAME, { access: "public", useCache: false });
		if (result?.statusCode !== 200) return DEFAULT_STATE;
		return parseDemoState(JSON.parse(await new Response(result.stream).text()));
	} catch {
		// Missing blob (never set) or a Blob outage: the defined fallback is sample data.
		return DEFAULT_STATE;
	}
}

export async function writeDemoState(mode: DemoMode): Promise<DemoState> {
	const state: DemoState = { mode, updatedAt: new Date().toISOString() };
	await put(PATHNAME, JSON.stringify(state), {
		access: "public",
		contentType: "application/json",
		addRandomSuffix: false,
		allowOverwrite: true,
		cacheControlMaxAge: 60,
	});
	return state;
}
