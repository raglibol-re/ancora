import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the Blob store: files with a version that changes on every write, the two
// write conditions the discussion store relies on, and a count of what was asked of it.
const blob = vi.hoisted(() => {
	class BlobPreconditionFailedError extends Error {}
	const files = new Map<string, { body: string; etag: string }>();
	const calls = { get: 0, list: 0, put: 0 };
	let version = 0;
	/** Runs once before the next write, standing in for someone else writing first. */
	const racing: { write: (() => void) | null } = { write: null };
	const write = (pathname: string, body: string) => {
		version += 1;
		files.set(pathname, { body, etag: `v${version}` });
	};
	return { BlobPreconditionFailedError, files, calls, racing, write };
});

vi.mock("@vercel/blob", () => ({
	BlobPreconditionFailedError: blob.BlobPreconditionFailedError,
	get: async (pathname: string) => {
		blob.calls.get += 1;
		const file = blob.files.get(pathname);
		if (!file) return null;
		return {
			statusCode: 200,
			stream: new Response(file.body).body,
			blob: { etag: file.etag },
		};
	},
	list: async ({ prefix }: { prefix: string }) => {
		blob.calls.list += 1;
		const blobs = [...blob.files.keys()]
			.filter((pathname) => pathname.startsWith(prefix))
			.map((pathname) => ({ pathname }));
		return { blobs };
	},
	put: async (
		pathname: string,
		body: string,
		options: { ifMatch?: string; allowOverwrite?: boolean },
	) => {
		blob.calls.put += 1;
		const racing = blob.racing.write;
		blob.racing.write = null;
		racing?.();
		const existing = blob.files.get(pathname);
		if (options.ifMatch !== undefined && existing?.etag !== options.ifMatch) {
			throw new blob.BlobPreconditionFailedError();
		}
		if (options.ifMatch === undefined && existing && options.allowOverwrite !== true) {
			throw new Error("This blob already exists.");
		}
		blob.write(pathname, body);
	},
}));

import { listThreads, parseEntries, type StoredEntry, updateThreads } from "./discussionStore.js";

const entry = (id: string, at: number, text = "A point"): StoredEntry => ({
	id,
	requestId: "7",
	authorId: "CAUTHOR",
	at,
	kind: "pro",
	text,
	answered: false,
	reactions: {},
});

const stored = (org: string): StoredEntry[] =>
	parseEntries(JSON.parse(blob.files.get(`discussions/${org}.json`)?.body ?? "null"));

beforeEach(() => {
	blob.files.clear();
	blob.calls.get = 0;
	blob.calls.list = 0;
	blob.calls.put = 0;
	blob.racing.write = null;
});

describe("stored discussion entries", () => {
	it("keeps complete entries, oldest first, and drops the rest", () => {
		const entries = parseEntries({
			entries: [
				entry("b", 2),
				{ id: "broken", text: "no author" },
				{ ...entry("a", 1), kind: "rant" },
				{ ...entry("c", 1), reactions: { CMEMBER: "up", COTHER: "sideways" }, answered: "yes" },
				null,
			],
		});
		expect(entries.map((e) => e.id)).toEqual(["c", "b"]);
		expect(entries[0]).toMatchObject({ reactions: { CMEMBER: "up" }, answered: false });
	});

	it("reads nothing from what isn't a discussion file", () => {
		expect(parseEntries(null)).toEqual([]);
		expect(parseEntries({ entries: "many" })).toEqual([]);
	});
});

describe("an organization's discussion file", () => {
	it("is one file that a later write extends", async () => {
		await updateThreads("ORG1", (entries) => [...entries, entry("a", 1)]);
		await updateThreads("ORG1", (entries) => [...entries, entry("b", 2)]);
		expect(stored("ORG1").map((e) => e.id)).toEqual(["a", "b"]);
		expect([...blob.files.keys()]).toEqual(["discussions/ORG1.json"]);
	});

	it("answers from the instance for a while after reading or writing", async () => {
		await updateThreads("ORG2", () => [entry("a", 1)]);
		const before = { ...blob.calls };
		expect((await listThreads("ORG2")).map((e) => e.id)).toEqual(["a"]);
		expect(blob.calls).toEqual(before);
	});

	it("applies a change to the newer version when someone else wrote first", async () => {
		await updateThreads("ORG3", () => [entry("a", 1)]);
		blob.racing.write = () =>
			blob.write(
				"discussions/ORG3.json",
				JSON.stringify({ entries: [entry("a", 1), entry("b", 2)] }),
			);
		await updateThreads("ORG3", (entries) => [...entries, entry("c", 3)]);
		expect(stored("ORG3").map((e) => e.id)).toEqual(["a", "b", "c"]);
	});

	it("doesn't replace a file someone else created a moment ago", async () => {
		blob.racing.write = () =>
			blob.write("discussions/ORG4.json", JSON.stringify({ entries: [entry("a", 1)] }));
		await updateThreads("ORG4", (entries) => [...entries, entry("b", 2)]);
		expect(stored("ORG4").map((e) => e.id)).toEqual(["a", "b"]);
	});

	it("writes nothing when the change refuses", async () => {
		await updateThreads("ORG5", () => [entry("a", 1)]);
		await expect(
			updateThreads("ORG5", () => {
				throw new Error("refused");
			}),
		).rejects.toThrow("refused");
		expect(stored("ORG5").map((e) => e.id)).toEqual(["a"]);
	});

	it("takes over what the organization wrote in the old layout", async () => {
		const old = "discussions/ORG6/7";
		blob.write(
			`${old}/a.json`,
			JSON.stringify({ authorId: "CAUTHOR", at: 1, kind: "question", text: "Why?" }),
		);
		blob.write(`${old}/a.answered`, "1");
		blob.write(`${old}/a.r.CMEMBER.up`, "1");
		expect(await listThreads("ORG6")).toEqual([
			{ ...entry("a", 1, "Why?"), kind: "question", answered: true, reactions: { CMEMBER: "up" } },
		]);
		await updateThreads("ORG6", (entries) => [...entries, entry("b", 2)]);
		expect(stored("ORG6").map((e) => e.id)).toEqual(["a", "b"]);
	});
});
