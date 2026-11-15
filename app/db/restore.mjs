#!/usr/bin/env node
// Puts the rows of a db/backup.mjs file back into the database in DATABASE_URL. Apply the schema
// first (pnpm db:schema). Rows that already exist are kept as they are, so a restore never
// overwrites newer data and can run again.
//
//   pnpm db:restore <file>   reads DATABASE_URL from .env.local

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { TABLES } from "./tables.mjs";

const url = process.env.DATABASE_URL;
const file = process.argv[2];
if (!url || !file) {
	process.stderr.write("Usage: DATABASE_URL=… node db/restore.mjs <file>\n");
	process.exit(1);
}

const COLUMN = /^[a-z_]+$/;
const backup = JSON.parse(await readFile(file, "utf8"));
const sql = neon(url);
const counts = [];
for (const table of TABLES) {
	const rows = backup.tables?.[table] ?? [];
	let added = 0;
	for (const row of rows) {
		const columns = Object.keys(row);
		// Column names are interpolated, so a tampered file must not smuggle SQL in through them.
		if (!columns.every((column) => COLUMN.test(column))) {
			throw new Error(`Unexpected column in ${table}: ${columns.join(", ")}`);
		}
		const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
		const inserted = await sql.query(
			`insert into ${table} (${columns.join(", ")}) values (${placeholders}) on conflict do nothing returning 1`,
			columns.map((column) => row[column]),
		);
		added += inserted.length;
	}
	counts.push(`${table} ${added} of ${rows.length}`);
}
process.stdout.write(`Restored from ${backup.takenAt}: ${counts.join(", ")}.\n`);
