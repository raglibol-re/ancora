import { nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { isOrganization, readView } from "./_lib/contracts.js";
import {
	type EntryKind,
	findEntry,
	listThreads,
	markAnswered,
	newEntryId,
	putEntry,
	setReaction,
} from "./_lib/discussionStore.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// Discussion on approval requests, off-chain (see docs/DECISIONS.md). The server checks that
// the organization is an ancora organization and that the person is one of its members by
// reading the contract; entries are not yet signed by the person's passkey (roadmap), so the
// author field is a claim the server verifies against membership, not a proof.

const KINDS = new Set<EntryKind>(["pro", "contra", "question", "comment"]);
const MAX_TEXT = 500;

export const config = { maxDuration: 30 };

function orgParam(value: unknown): string {
	if (typeof value !== "string" || !StrKey.isValidContract(value)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	return value;
}

function personParam(value: unknown): string {
	if (typeof value !== "string" || !StrKey.isValidContract(value)) {
		throw new RequestError("Send the person's ancora ID (C…).");
	}
	return value;
}

function requestParam(value: unknown): string {
	if (typeof value !== "string" || !/^\d{1,18}$/.test(value)) {
		throw new RequestError("Send the request id.");
	}
	return value;
}

async function requireMember(org: string, person: string) {
	const settings = serverConfig();
	if (!(await isOrganization(settings, org))) {
		throw new RequestError("Discussions exist only on ancora organizations.", 403);
	}
	const members = (await readView(settings, org, "members")) as { address: unknown }[];
	if (!members.some((m) => String(m.address) === person)) {
		throw new RequestError("Only members of the organization take part in its discussions.", 403);
	}
	return settings;
}

const handler = {
	async fetch(request: Request): Promise<Response> {
		return (request.method === "GET" ? read : write).fetch(request);
	},
};

const read = apiHandler("GET", async (request) => {
	const org = orgParam(new URL(request.url).searchParams.get("org"));
	return { entries: await listThreads(org) };
});

const write = apiHandler("POST", async (request) => {
	const body = await readJsonObject(request);
	const org = orgParam(body.org);
	const requestId = requestParam(body.requestId);
	const person = personParam(body.person);
	const settings = await requireMember(org, person);

	switch (body.action) {
		case "post": {
			const kind = body.kind;
			const text = typeof body.text === "string" ? body.text.trim() : "";
			if (!KINDS.has(kind as EntryKind))
				throw new RequestError("Pick pro, contra, question or comment.");
			if (!text || text.length > MAX_TEXT) {
				throw new RequestError(`Write something, up to ${MAX_TEXT} characters.`);
			}
			// The request has to exist; the contract errors on unknown ids.
			await readView(settings, org, "request", [nativeToScVal(BigInt(requestId), { type: "u64" })]);
			const now = Date.now();
			const entry = {
				id: newEntryId(now),
				requestId,
				authorId: person,
				at: now,
				kind: kind as EntryKind,
				text,
				answered: false,
				reactions: {},
			};
			await putEntry(org, entry);
			return { entry };
		}
		case "react": {
			const entryId = String(body.entryId ?? "");
			const reaction = body.reaction;
			if (reaction !== "up" && reaction !== "down" && reaction !== null) {
				throw new RequestError("A reaction is up, down or none.");
			}
			const entry = await findEntry(org, requestId, entryId);
			if (!entry) throw new RequestError("This entry doesn't exist anymore.", 404);
			if (entry.authorId === person) throw new RequestError("You can't react to your own entry.");
			await setReaction(org, requestId, entryId, person, reaction);
			return { ok: true };
		}
		case "answer": {
			const entryId = String(body.entryId ?? "");
			const entry = await findEntry(org, requestId, entryId);
			if (!entry || entry.kind !== "question") {
				throw new RequestError("Only questions can be marked answered.");
			}
			const onchain = (await readView(settings, org, "request", [
				nativeToScVal(BigInt(requestId), { type: "u64" }),
			])) as { requester: unknown };
			if (String(onchain.requester) !== person) {
				throw new RequestError(
					"Only the requester marks questions on their request as answered.",
					403,
				);
			}
			await markAnswered(org, requestId, entryId);
			return { ok: true };
		}
		default:
			throw new RequestError("Unknown action.");
	}
});

export default handler;
