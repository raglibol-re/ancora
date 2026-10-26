import { StrKey } from "@stellar/stellar-sdk";
import { get, put } from "@vercel/blob";
import { isOrganization, readView } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// The name an organization registered for its treasury on the Stellar Registry. The registry
// resolves a name to a contract, not the other way round, so ancora remembers the name per
// organization (`registry-names/<org>.json` in Vercel Blob) and the app verifies it against the
// registry on every read. Only members may record it; the registration itself is on-chain.

const NAME = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const config = { maxDuration: 30 };

const pathOf = (org: string) => `registry-names/${org}.json`;

function orgParam(value: unknown): string {
	if (typeof value !== "string" || !StrKey.isValidContract(value)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	return value;
}

const read = apiHandler("GET", async (request) => {
	const org = orgParam(new URL(request.url).searchParams.get("org"));
	const result = await get(pathOf(org), { access: "public", useCache: false });
	if (result?.statusCode !== 200) return { name: null };
	const parsed = JSON.parse(await new Response(result.stream).text()) as { name?: unknown };
	return { name: typeof parsed.name === "string" ? parsed.name : null };
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
	await put(pathOf(org), JSON.stringify({ name, by: person, at: Date.now() }), {
		access: "public",
		addRandomSuffix: false,
		allowOverwrite: true,
		cacheControlMaxAge: 0,
		contentType: "application/json",
	});
	return { name };
});

const handler = {
	async fetch(request: Request): Promise<Response> {
		return (request.method === "GET" ? read : write).fetch(request);
	},
};

export default handler;
