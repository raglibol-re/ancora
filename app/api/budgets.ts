import { StrKey } from "@stellar/stellar-sdk";
import { get, put } from "@vercel/blob";
import { isOrganization, readView } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// Budgets are planning information, off-chain in Vercel Blob (see docs/DECISIONS.md): one small
// JSON file per organization, `budgets/<org>.json`, last write wins. The server checks that the
// organization is an ancora organization and that the writer is one of its members by reading
// the contract; the app only offers editing to the people who may manage the treasury.

type Budget = { category: string; amount: number };

const MAX_BUDGETS = 50;
const CATEGORY = /^[a-z0-9][a-z0-9-]{0,23}$/;

export const config = { maxDuration: 30 };

function orgParam(value: unknown): string {
	if (typeof value !== "string" || !StrKey.isValidContract(value)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	return value;
}

function parseBudgets(value: unknown): Budget[] {
	if (!Array.isArray(value) || value.length > MAX_BUDGETS) {
		throw new RequestError(`Send up to ${MAX_BUDGETS} budgets.`);
	}
	const seen = new Set<string>();
	return value.map((entry: unknown) => {
		const budget = entry as Partial<Budget>;
		if (typeof budget.category !== "string" || !CATEGORY.test(budget.category)) {
			throw new RequestError("A category is lowercase letters, digits and dashes.");
		}
		if (!Number.isSafeInteger(budget.amount) || (budget.amount ?? 0) <= 0) {
			throw new RequestError("A budget amount is a whole number of cents above zero.");
		}
		if (seen.has(budget.category)) throw new RequestError("Each category once.");
		seen.add(budget.category);
		return { category: budget.category, amount: budget.amount as number };
	});
}

const pathOf = (org: string) => `budgets/${org}.json`;

async function readBudgets(org: string): Promise<Budget[]> {
	const result = await get(pathOf(org), { access: "public", useCache: false });
	if (result?.statusCode !== 200) return [];
	const parsed = JSON.parse(await new Response(result.stream).text()) as { budgets?: unknown };
	return Array.isArray(parsed.budgets) ? (parsed.budgets as Budget[]) : [];
}

const read = apiHandler("GET", async (request) => {
	const org = orgParam(new URL(request.url).searchParams.get("org"));
	return { budgets: await readBudgets(org) };
});

const write = apiHandler("POST", async (request) => {
	const body = await readJsonObject(request);
	const org = orgParam(body.org);
	const person = body.person;
	if (typeof person !== "string" || !StrKey.isValidContract(person)) {
		throw new RequestError("Send the person's ancora ID (C…).");
	}
	const budgets = parseBudgets(body.budgets);
	const settings = serverConfig();
	if (!(await isOrganization(settings, org))) {
		throw new RequestError("Budgets exist only on ancora organizations.", 403);
	}
	const members = (await readView(settings, org, "members")) as { address: unknown }[];
	if (!members.some((m) => String(m.address) === person)) {
		throw new RequestError("Only members of the organization set its budgets.", 403);
	}
	await put(pathOf(org), JSON.stringify({ budgets, updatedAt: Date.now(), by: person }), {
		access: "public",
		addRandomSuffix: false,
		allowOverwrite: true,
		cacheControlMaxAge: 0,
		contentType: "application/json",
	});
	return { budgets };
});

const handler = {
	async fetch(request: Request): Promise<Response> {
		return (request.method === "GET" ? read : write).fetch(request);
	},
};

export default handler;
