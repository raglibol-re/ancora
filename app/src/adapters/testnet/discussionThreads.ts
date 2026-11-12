import type { DiscussionEntry } from "../../domain/discussion.ts";

// Discussion threads live on ancora's server, not on Stellar. They are read when a screen that
// shows requests opens, not with every refresh, and kept here per organization meanwhile.

export type Threads = Readonly<Record<string, readonly DiscussionEntry[]>>;

/** Discussions read this recently aren't read again when another screen opens. */
export const DISCUSSIONS_FRESH_MS = 30_000;

export function byRequest(entries: readonly DiscussionEntry[]): Threads {
	const threads: Record<string, DiscussionEntry[]> = {};
	for (const entry of entries) {
		const thread = threads[entry.requestId] ?? [];
		thread.push(entry);
		threads[entry.requestId] = thread;
	}
	return threads;
}

/** An organization's entries from ancora's server; null when it didn't answer with them. */
export async function fetchDiscussionEntries(orgId: string): Promise<DiscussionEntry[] | null> {
	const response = await fetch(`/api/discussions?org=${encodeURIComponent(orgId)}`).catch(
		() => null,
	);
	const payload = (await response?.json().catch(() => null)) as {
		success?: boolean;
		data?: { entries?: DiscussionEntry[] };
	} | null;
	return payload?.success && payload.data?.entries ? payload.data.entries : null;
}

export class DiscussionThreads {
	private readonly read = new Map<string, { at: number; threads: Threads }>();
	private readonly fetchEntries: (orgId: string) => Promise<DiscussionEntry[] | null>;
	private readonly now: () => number;

	constructor(
		fetchEntries: (orgId: string) => Promise<DiscussionEntry[] | null> = fetchDiscussionEntries,
		now: () => number = Date.now,
	) {
		this.fetchEntries = fetchEntries;
		this.now = now;
	}

	/** What was read so far for the organization; undefined when nothing was. */
	of(orgId: string): Threads | undefined {
		return this.read.get(orgId)?.threads;
	}

	/** Threads from an earlier visit: shown until a screen reads them again. */
	remember(orgId: string, threads: Threads): void {
		this.read.set(orgId, { at: 0, threads });
	}

	/** The organization's entries as the server just answered them. */
	set(orgId: string, entries: readonly DiscussionEntry[]): void {
		this.read.set(orgId, { at: this.now(), threads: byRequest(entries) });
	}

	/**
	 * Reads the organizations that weren't read in the last half minute. `changed` says whether
	 * anything new arrived, `complete` whether every wanted organization could be read.
	 */
	async load(orgIds: readonly string[]): Promise<{ changed: boolean; complete: boolean }> {
		const started = this.now();
		const stale = orgIds.filter(
			(orgId) => started - (this.read.get(orgId)?.at ?? 0) > DISCUSSIONS_FRESH_MS,
		);
		const arrived = await Promise.all(
			stale.map(async (orgId) => {
				const entries = await this.fetchEntries(orgId);
				if (entries) this.set(orgId, entries);
				return entries !== null;
			}),
		);
		return { changed: arrived.some(Boolean), complete: arrived.every(Boolean) };
	}
}
