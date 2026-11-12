import { sql } from "./database.js";

// Which organizations exist, for jobs that must visit every one of them (due standing orders).
// The registry answers "is this an organization?" and "which ones does this person have?", not
// "list them all", so ancora keeps one row per organization: written when the operator deploys
// one, and when the app opens one that the index doesn't know yet.

/** Organizations this function instance knows are in the index, to spare the query. */
const known = new Set<string>();

/** Adds the organization to the index; apps announce every organization they open. */
export async function rememberOrganization(contractId: string): Promise<void> {
	if (known.has(contractId)) return;
	await sql()`
		insert into organizations (contract_id) values (${contractId})
		on conflict (contract_id) do nothing`;
	known.add(contractId);
}

/** Every organization the index knows, in no particular order. */
export async function listOrganizations(): Promise<string[]> {
	const rows = await sql()`select contract_id from organizations`;
	return rows.map((row) => String(row.contract_id));
}
