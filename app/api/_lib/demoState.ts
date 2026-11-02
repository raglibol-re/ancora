import { get, put } from "@vercel/blob";

// The one piece of site-wide demo state: which data source visitors get by default. It lives in
// Vercel Blob (see docs/DECISIONS.md); everything else is on-chain or in the browser. Every visit
// asks for it (`/api/health`), so a function instance keeps it for a minute instead of reading
// Blob each time; when Blob can't be read, DEFAULT_DATA_SOURCE decides (sample unless set).

export type DemoMode = "sample" | "testnet";

export type DemoState = {
	mode: DemoMode;
	updatedAt: string | null;
};

const PATHNAME = "demo/state.json";
const KEEP_MS = 60_000;

/** What visitors get when the stored state can't be read. */
function fallbackState(): DemoState {
	return {
		mode: process.env.DEFAULT_DATA_SOURCE === "testnet" ? "testnet" : "sample",
		updatedAt: null,
	};
}

let kept: { state: DemoState; until: number } | null = null;

export function parseDemoState(value: unknown): DemoState {
	if (!value || typeof value !== "object") return fallbackState();
	const { mode, updatedAt } = value as Partial<DemoState>;
	return {
		mode: mode === "testnet" ? "testnet" : "sample",
		updatedAt: typeof updatedAt === "string" ? updatedAt : null,
	};
}

export async function readDemoState(): Promise<DemoState> {
	if (kept && kept.until > Date.now()) return kept.state;
	const state = await readStored();
	kept = { state, until: Date.now() + KEEP_MS };
	return state;
}

async function readStored(): Promise<DemoState> {
	try {
		const result = await get(PATHNAME, { access: "public", useCache: false });
		if (result?.statusCode !== 200) {
			// biome-ignore lint/suspicious/noConsole: server-side log line for the operator
			console.warn(
				`[demo state] ${PATHNAME} answered ${result?.statusCode ?? "nothing"}; using the fallback`,
			);
			return fallbackState();
		}
		return parseDemoState(JSON.parse(await new Response(result.stream).text()));
	} catch (error) {
		// A Blob outage, a store that can't be reached or a used-up quota: the fallback applies,
		// logged so the operator sees why visitors got it.
		console.error(`[demo state] ${error instanceof Error ? error.message : String(error)}`);
		return fallbackState();
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
	// This instance answers with the new mode at once; others within the minute.
	kept = { state, until: Date.now() + KEEP_MS };
	return state;
}
