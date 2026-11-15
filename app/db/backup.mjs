#!/usr/bin/env node
// Writes every off-chain table to one JSON file: { takenAt, tables: { <table>: [rows] } }. Rows
// only; the schema is db/schema.sql. The nightly Backup workflow encrypts the file and keeps it
// as a workflow artifact; db/restore.mjs reads it back. See docs/DECISIONS.md (2026-11-15).
//
//   pnpm db:backup <file>   reads DATABASE_URL from .env.local

import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { TABLES } from "./tables.mjs";

const url = process.env.DATABASE_URL;
const file = process.argv[2];
if (!url || !file) {
	process.stderr.write("Usage: DATABASE_URL=… node db/backup.mjs <file>\n");
	process.exit(1);
}

const sql = neon(url);
const tables = {};
for (const table of TABLES) {
	// Table names come from the fixed list in tables.mjs, never from input.
	tables[table] = await sql.query(`select * from ${table}`);
}
await writeFile(file, JSON.stringify({ takenAt: new Date().toISOString(), tables }));
const counts = TABLES.map((table) => `${table} ${tables[table].length}`).join(", ");
process.stdout.write(`Backed up ${counts}.\n`);
