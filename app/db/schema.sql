-- ancora's off-chain records (Neon Postgres; see docs/DECISIONS.md, 2026-11-12). Money, rules,
-- members and requests are on Stellar; this holds only what can't or shouldn't live there.
-- Every statement can run again: `pnpm db:schema` applies the file as it is.

-- Which organizations exist, for the jobs that visit every one of them (due standing orders,
-- requests past their objection window, deal milestones).
create table if not exists organizations (
	contract_id text primary key,
	seen_at timestamptz not null default now()
);

-- The name an organization registered for its treasury on the Stellar Registry, which resolves
-- names to contracts but not the other way round. The app verifies it against the registry.
create table if not exists registry_names (
	org text primary key,
	name text not null,
	recorded_by text not null,
	recorded_at timestamptz not null default now()
);

-- Discussion on approval requests: reasons for and against, questions and comments.
create table if not exists discussion_entries (
	id text primary key,
	org text not null,
	request_id text not null,
	author_id text not null,
	-- Milliseconds since 1970, as the app shows and sorts it.
	at bigint not null,
	kind text not null check (kind in ('pro', 'contra', 'question', 'comment')),
	body text not null,
	answered boolean not null default false
);

create index if not exists discussion_entries_org on discussion_entries (org, at);

-- One thumbs up or down per person and entry.
create table if not exists discussion_reactions (
	entry_id text not null references discussion_entries (id) on delete cascade,
	person text not null,
	reaction text not null check (reaction in ('up', 'down')),
	primary key (entry_id, person)
);

-- The devices a person turned notifications on for.
create table if not exists push_subscriptions (
	person text not null,
	endpoint text not null,
	p256dh text not null,
	auth text not null,
	created_at timestamptz not null default now(),
	primary key (person, endpoint)
);

-- Profile pictures and organization logos (at most 300 KB each), addressed by the SHA-256 of
-- their bytes. Base64 text, because the HTTP driver carries text reliably.
create table if not exists images (
	hash text primary key,
	content_type text not null,
	data text not null,
	created_at timestamptz not null default now()
);
