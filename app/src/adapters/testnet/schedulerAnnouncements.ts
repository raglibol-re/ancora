import type { KeyValueStorage } from "../local/workspaceStore.ts";

// The server's scheduler visits every organization it knows (due standing orders, requests past
// their objection window). It learns of the ones it deploys; the app tells it about every other
// organization it opens, once per device.

// v2: the index moved to a database on 12 Nov 2026, so every device announces once more.
const ANNOUNCED_KEY = "ancora.indexed.v2";

/** Tells the server about one organization; resolves to whether the server has it now. */
export async function announceToScheduler(organization: string): Promise<boolean> {
	const response = await fetch("/api/due", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organization }),
	}).catch(() => null);
	return response?.ok === true;
}

export class SchedulerAnnouncements {
	private readonly announced: Set<string>;
	private readonly storage: KeyValueStorage | null;
	private readonly announce: (organization: string) => Promise<boolean>;

	constructor(
		storage: KeyValueStorage | null,
		announce: (organization: string) => Promise<boolean> = announceToScheduler,
	) {
		this.storage = storage;
		this.announce = announce;
		this.announced = new Set(readAnnounced(storage));
	}

	/**
	 * Announces the organizations this device hasn't announced yet. One is remembered only once
	 * the server has it; otherwise the next call announces it again. Best effort and silent.
	 */
	async announceNew(organizations: readonly string[]): Promise<void> {
		for (const organization of organizations) {
			if (this.announced.has(organization)) continue;
			if (await this.announce(organization)) this.announced.add(organization);
		}
		try {
			this.storage?.setItem(ANNOUNCED_KEY, JSON.stringify([...this.announced]));
		} catch {
			// No storage (private window): the next visit announces again.
		}
	}
}

function readAnnounced(storage: KeyValueStorage | null): string[] {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(ANNOUNCED_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		// No storage or a damaged entry: announce again, which is harmless.
		return [];
	}
}
