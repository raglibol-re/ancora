import { type NeonQueryFunction, neon } from "@neondatabase/serverless";
import { required } from "./serverConfig.js";

// ancora's off-chain records live in a Neon Postgres database (schema: app/db/schema.sql; why:
// docs/DECISIONS.md, 2026-11-12). Queries travel over HTTPS, one request each, so a function
// holds no connection open between invocations.

let client: NeonQueryFunction<false, false> | null = null;

/**
 * The query function: `await sql()`select … where org = ${org}``. Values in the template
 * are sent as parameters, never pasted into the statement.
 */
export function sql(): NeonQueryFunction<false, false> {
	client ??= neon(required("DATABASE_URL"));
	return client;
}
