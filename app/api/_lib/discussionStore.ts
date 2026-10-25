import { del, get, list, put } from "@vercel/blob";

// Discussion threads live in Vercel Blob as small append-only files, one per entry, reaction
// and "answered" mark, so two people posting at once never overwrite each other:
//
//   discussions/<org>/<request>/<entry>.json                 the entry (author, kind, text)
//   discussions/<org>/<request>/<entry>.answered             the requester closed the question
//   discussions/<org>/<request>/<entry>.r.<person>.<up|down> one reaction per person
//
// Everything but the text is encoded in the pathname, so a listing answers most questions.

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
const ENTRY = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.json$/;
const ANSWERED = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.answered$/;
const REACTION = /^discussions\/([^/]+)\/([^/]+)\/([^/.]+)\.r\.([^.]+)\.(up|down)$/;

const putOptions = {
	access: "public" as const,
	addRandomSuffix: false,
	allowOverwrite: true,
	cacheControlMaxAge: 0,
};

async function readJson(pathname: string): Promise<unknown> {
	const result = await get(pathname, { access: "public", useCache: false });
	if (result?.statusCode !== 200) return null;
	return JSON.parse(await new Response(result.stream).text());
}

/** Every entry of every request of an organization, oldest first. */
export async function listThreads(org: string): Promise<StoredEntry[]> {
	const { blobs } = await list({ prefix: `${ROOT}/${org}/`, limit: 1000 });
	const entries = new Map<string, StoredEntry>();
	const answered = new Set<string>();
	const reactions: { entryId: string; person: string; reaction: Reaction }[] = [];
	await Promise.all(
		blobs.map(async (blob) => {
			const asEntry = ENTRY.exec(blob.pathname);
			if (asEntry) {
				const body = (await readJson(blob.pathname)) as Partial<StoredEntry> | null;
				if (!body || typeof body.text !== "string") return;
				entries.set(asEntry[3] as string, {
					id: asEntry[3] as string,
					requestId: asEntry[2] as string,
					authorId: String(body.authorId),
					at: Number(body.at),
					kind: body.kind as EntryKind,
					text: body.text,
					answered: false,
					reactions: {},
				});
				return;
			}
			const asAnswered = ANSWERED.exec(blob.pathname);
			if (asAnswered) answered.add(asAnswered[3] as string);
			const asReaction = REACTION.exec(blob.pathname);
			if (asReaction) {
				reactions.push({
					entryId: asReaction[3] as string,
					person: asReaction[4] as string,
					reaction: asReaction[5] as Reaction,
				});
			}
		}),
	);
	for (const id of answered) {
		const entry = entries.get(id);
		if (entry) entry.answered = true;
	}
	for (const { entryId, person, reaction } of reactions) {
		const entry = entries.get(entryId);
		if (entry) entry.reactions[person] = reaction;
	}
	return [...entries.values()].sort((a, b) => a.at - b.at);
}

export async function findEntry(org: string, requestId: string, entryId: string) {
	const entries = await listThreads(org);
	return entries.find((e) => e.id === entryId && e.requestId === requestId) ?? null;
}

/** Ids sort chronologically in listings and stay unique across people posting at once. */
export function newEntryId(now: number): string {
	return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function putEntry(org: string, entry: StoredEntry): Promise<void> {
	await put(
		`${ROOT}/${org}/${entry.requestId}/${entry.id}.json`,
		JSON.stringify({ authorId: entry.authorId, at: entry.at, kind: entry.kind, text: entry.text }),
		{ ...putOptions, contentType: "application/json" },
	);
}

export async function markAnswered(org: string, requestId: string, entryId: string) {
	await put(`${ROOT}/${org}/${requestId}/${entryId}.answered`, "1", {
		...putOptions,
		contentType: "text/plain",
	});
}

/** Replaces the person's reaction; null removes it. */
export async function setReaction(
	org: string,
	requestId: string,
	entryId: string,
	person: string,
	reaction: Reaction | null,
) {
	const prefix = `${ROOT}/${org}/${requestId}/${entryId}.r.${person}.`;
	const { blobs } = await list({ prefix, limit: 10 });
	if (blobs.length > 0) await del(blobs.map((b) => b.url));
	if (reaction) {
		await put(`${prefix}${reaction}`, "1", { ...putOptions, contentType: "text/plain" });
	}
}
