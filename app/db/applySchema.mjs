#!/usr/bin/env node
// Applies db/schema.sql to the database in DATABASE_URL, one statement at a time (the HTTP
// driver takes one per request). Every statement in the file can run again.
//
//   pnpm db:schema        reads DATABASE_URL from .env.local

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
	process.stderr.write("DATABASE_URL is not set: put the Neon connection string in .env.local.\n");
	process.exit(1);
}

const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
const statements = schema
	.replace(/^\s*--.*$/gm, "")
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

const sql = neon(url);
for (const statement of statements) {
	await sql.query(statement);
}
process.stdout.write(`Applied ${statements.length} statements from db/schema.sql.\n`);
