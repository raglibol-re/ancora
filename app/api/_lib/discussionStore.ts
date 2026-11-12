import { sql } from "./database.js";

// Discussion threads: one row per entry and one per reaction (app/db/schema.sql), so two people
// posting or reacting at once never overwrite each other.

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

/** A row of the listing query as an entry; `at` arrives as text because it is a bigint. */
export function entryOf(row: Record<string, unknown>): StoredEntry {
	const reactions: Record<string, Reaction> = {};
	for (const [person, reaction] of Object.entries(row.reactions ?? {})) {
		if (reaction === "up" || reaction === "down") reactions[person] = reaction;
	}
	return {
		id: String(row.id),
		requestId: String(row.request_id),
		authorId: String(row.author_id),
		at: Number(row.at),
		kind: row.kind as EntryKind,
		text: String(row.body),
		answered: row.answered === true,
		reactions,
	};
}

/** Every entry of every request of an organization, oldest first. */
export async function listThreads(org: string): Promise<StoredEntry[]> {
	const rows = await sql()`
		select e.id, e.request_id, e.author_id, e.at, e.kind, e.body, e.answered,
			coalesce(
				(select jsonb_object_agg(r.person, r.reaction)
					from discussion_reactions r where r.entry_id = e.id),
				'{}'::jsonb
			) as reactions
		from discussion_entries e
		where e.org = ${org}
		order by e.at, e.id`;
	return rows.map(entryOf);
}

/** Who wrote an entry and what kind it is; null when the request has no such entry. */
export async function findEntry(
	org: string,
	requestId: string,
	entryId: string,
): Promise<{ authorId: string; kind: EntryKind } | null> {
	const [row] = await sql()`
		select author_id, kind from discussion_entries
		where id = ${entryId} and org = ${org} and request_id = ${requestId}`;
	return row ? { authorId: String(row.author_id), kind: row.kind as EntryKind } : null;
}

/** Ids sort chronologically and stay unique across people posting at once. */
export function newEntryId(now: number): string {
	return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function addEntry(
	org: string,
	entry: Pick<StoredEntry, "id" | "requestId" | "authorId" | "at" | "kind" | "text">,
): Promise<void> {
	await sql()`
		insert into discussion_entries (id, org, request_id, author_id, at, kind, body)
		values (${entry.id}, ${org}, ${entry.requestId}, ${entry.authorId}, ${entry.at},
			${entry.kind}, ${entry.text})`;
}

export async function markAnswered(entryId: string): Promise<void> {
	await sql()`update discussion_entries set answered = true where id = ${entryId}`;
}

/** Replaces the person's reaction; null removes it. */
export async function setReaction(
	entryId: string,
	person: string,
	reaction: Reaction | null,
): Promise<void> {
	if (reaction === null) {
		await sql()`
			delete from discussion_reactions where entry_id = ${entryId} and person = ${person}`;
		return;
	}
	await sql()`
		insert into discussion_reactions (entry_id, person, reaction)
		values (${entryId}, ${person}, ${reaction})
		on conflict (entry_id, person) do update set reaction = excluded.reaction`;
}
