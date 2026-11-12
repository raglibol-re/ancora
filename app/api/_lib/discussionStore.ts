import { BlobPreconditionFailedError, get, list, put } from "@vercel/blob";

// Discussion threads live in Vercel Blob, one JSON file per organization:
//
//   discussions/<org>.json    { entries: StoredEntry[] }, oldest first
//
// Reading an organization's threads is one fetch. Two people posting at once don't overwrite
// each other: a write names the version it read (the file's ETag) and is repeated on the newer
// version when someone else was faster.

export type EntryKind = "pro" | "contra" | "question" | "comment";
export type Reaction = "up" | "down";

export type StoredEntry = {
	id: string;
	requestId: string;
	authorId: string;
	at: number;
	kind: EntryKind;
	text: string;
	answered: boolean;
	reactions: Record<string, Reaction>;
};

const ROOT = "discussions";
const KINDS: ReadonlySet<string> = new Set(["pro", "contra", "question", "comment"]);
/** How often a write is repeated when someone else wrote in between. */
const WRITE_ATTEMPTS = 4;

const pathOf = (org: string) => `${ROOT}/${org}.json`;

function parseReactions(value: unknown): Record<string, Reaction> {
	if (!value || typeof value !== "object") return {};
	const reactions: Record<string, Reaction> = {};
	for (const [person, reaction] of Object.entries(value)) {
		if (reaction === "up" || reaction === "down") reactions[person] = reaction;
	}
	return reactions;
}

/** The entries of a stored file; anything that isn't a complete entry is left out. */
export function parseEntries(value: unknown): StoredEntry[] {
	const list = (value as { entries?: unknown } | null)?.entries;
	if (!Array.isArray(list)) return [];
	const entries: StoredEntry[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const { id, requestId, authorId, at, kind, text, answered, reactions } = item as Record<
			string,
			unknown
		>;
		if (
			typeof id !== "string" ||
			typeof requestId !== "string" ||
			typeof authorId !== "string" ||
			typeof at !== "number" ||
			typeof kind !== "string" ||
			!KINDS.has(kind) ||
			typeof text !== "string"
		) {
			continue;
		}
		entries.push({
			id,
			requestId,
			authorId,
			at,
			kind: kind as EntryKind,
			text,
			answered: answered === true,
			reactions: parseReactions(reactions),
		});
	}
	return entries.sort((a, b) => a.at - b.at);
}

type Stored = { entries: StoredEntry[]; etag: string | null };

async function readStored(org: string): Promise<Stored> {
	const result = await get(pathOf(org), { access: "public", useCache: false });
	if (result?.statusCode === 200) {
		const body: unknown = JSON.parse(await new Response(result.stream).text());
		return { entries: parseEntries(body), etag: result.blob.etag };
	}
	// No file yet: what the organization wrote before 12 Nov 2026 is still in the old layout and
	// moves into the file with the next write.
	return { entries: await readLegacyThreads(org), etag: null };
}

/** How long a function instance answers an organization's threads without reading Blob. */
const KEEP_MS = 30_000;
const kept = new Map<string, { entries: StoredEntry[]; until: number }>();

function keep(org: string, entries: StoredEntry[]): void {
	kept.set(org, { entries, until: Date.now() + KEEP_MS });
}

/**
 * Every entry of every request of an organization, oldest first. An instance keeps them for
 * half a minute; its own writes replace them at once, other instances' show within that time.
 */
export async function listThreads(org: string): Promise<StoredEntry[]> {
	const hit = kept.get(org);
	if (hit && hit.until > Date.now()) return hit.entries;
	const { entries } = await readStored(org);
	keep(org, entries);
	return entries;
}

/**
 * Applies a change to the organization's threads as stored now (not as kept), so `change` also
 * decides whether the write may go ahead: it throws to refuse. Returns the entries written.
 */
export async function updateThreads(
	org: string,
	change: (entries: readonly StoredEntry[]) => StoredEntry[],
): Promise<StoredEntry[]> {
	let failure: unknown = null;
	for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
		const stored = await readStored(org);
		const entries = change(stored.entries);
		try {
			await put(pathOf(org), JSON.stringify({ entries }), {
				access: "public",
				addRandomSuffix: false,
				contentType: "application/json",
				cacheControlMaxAge: 60,
				// A first write must not replace a file someone else created a moment ago.
				...(stored.etag === null ? { allowOverwrite: false } : { ifMatch: stored.etag }),
			});
			keep(org, entries);
			return entries;
		} catch (error) {
			// Someone else wrote first: read their version and apply the change to it. A first
			// write that fails is repeated too, because "the file exists now" has no error class.
			if (stored.etag !== null && !(error instanceof BlobPreconditionFailedError)) throw error;
			failure = error;
		}
	}
	throw failure;
}

/** Ids sort chronologically and stay unique across people posting at once. */
export function newEntryId(now: number): string {
	return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// The layout before 12 Nov 2026: one small file per entry, reaction and "answered" mark. Read
// only for organizations that have no file yet; remove with docs/ROADMAP.md "Blob usage".
//
//   discussions/<org>/<request>/<entry>.json                 the entry (author, kind, text)
//   discussions/<org>/<request>/<entry>.answered             the requester closed the question
//   discussions/<org>/<request>/<entry>.r.<person>.<up|down> one reaction per person

const LEGACY_ENTRY = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.json$/;
const LEGACY_ANSWERED = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.answered$/;
const LEGACY_REACTION = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.r\.([^.]+)\.(up|down)$/;

async function readLegacyThreads(org: string): Promise<StoredEntry[]> {
	const { blobs } = await list({ prefix: `${ROOT}/${org}/`, limit: 1000 });
	const found: unknown[] = [];
	const answered = new Set<string>();
	const reactions = new Map<string, Record<string, Reaction>>();
	await Promise.all(
		blobs.map(async ({ pathname }) => {
			const asEntry = LEGACY_ENTRY.exec(pathname);
			if (asEntry) {
				const result = await get(pathname, { access: "public", useCache: false });
				if (result?.statusCode !== 200) return;
				const body: unknown = JSON.parse(await new Response(result.stream).text());
				if (body && typeof body === "object") {
					found.push({ ...body, id: asEntry[3], requestId: asEntry[2] });
				}
				return;
			}
			const asAnswered = LEGACY_ANSWERED.exec(pathname);
			if (asAnswered?.[3]) answered.add(asAnswered[3]);
			const asReaction = LEGACY_REACTION.exec(pathname);
			if (asReaction?.[3] && asReaction[4]) {
				const ofEntry = reactions.get(asReaction[3]) ?? {};
				ofEntry[asReaction[4]] = asReaction[5] as Reaction;
				reactions.set(asReaction[3], ofEntry);
			}
		}),
	);
	return parseEntries({ entries: found }).map((entry) => ({
		...entry,
		answered: answered.has(entry.id),
		reactions: reactions.get(entry.id) ?? {},
	}));
}
