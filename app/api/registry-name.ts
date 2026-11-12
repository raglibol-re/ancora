import { StrKey } from "@stellar/stellar-sdk";
import { isOrganization, readView } from "./_lib/contracts.js";
import { sql } from "./_lib/database.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// The name an organization registered for its treasury on the Stellar Registry. The registry
// resolves a name to a contract, not the other way round, so ancora remembers the name per
// organization (table `registry_names`) and the app verifies it against the registry on every
// read. Only members may record it; the registration itself is on-chain.

const NAME = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const config = { maxDuration: 30 };

function orgParam(value: unknown): string {
	if (typeof value !== "string" || !StrKey.isValidContract(value)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	return value;
}

const read = apiHandler("GET", async (request) => {
	const org = orgParam(new URL(request.url).searchParams.get("org"));
	const [row] = await sql()`select name from registry_names where org = ${org}`;
	return { name: row ? String(row.name) : null };
});

const write = apiHandler("POST", async (request) => {
	const body = await readJsonObject(request);
	const org = orgParam(body.org);
	const person = body.person;
	if (typeof person !== "string" || !StrKey.isValidContract(person)) {
		throw new RequestError("Send the person's ancora ID (C…).");
	}
	const name = body.name;
	if (typeof name !== "string" || !NAME.test(name)) {
		throw new RequestError("A registry name is 2 to 32 lowercase letters, digits or dashes.");
	}
	const settings = serverConfig();
	if (!(await isOrganization(settings, org))) {
		throw new RequestError("Only ancora organizations record a registry name.", 403);
	}
	const members = (await readView(settings, org, "members")) as { address: unknown }[];
	if (!members.some((m) => String(m.address) === person)) {
		throw new RequestError("Only members of the organization record its registry name.", 403);
	}
	await sql()`
		insert into registry_names (org, name, recorded_by) values (${org}, ${name}, ${person})
		on conflict (org) do update
			set name = excluded.name, recorded_by = excluded.recorded_by, recorded_at = now()`;
	return { name };
});

const handler = {
	async fetch(request: Request): Promise<Response> {
		return (request.method === "GET" ? read : write).fetch(request);
	},
};

export default handler;
