import { describe, expect, it } from "vitest";
import type { DiscussionEntry } from "../../domain/discussion.ts";
import { byRequest, DISCUSSIONS_FRESH_MS, DiscussionThreads } from "./discussionThreads.ts";

const entry = (id: string, requestId: string): DiscussionEntry => ({
	id,
	requestId,
	authorId: "CAUTHOR",
	at: 1,
	kind: "comment",
	text: "A point",
	answered: false,
	reactions: {},
});

/** A server that answers with the given entries per organization and counts the questions. */
function server(answers: Record<string, DiscussionEntry[] | null>) {
	const asked: string[] = [];
	const fetchEntries = async (orgId: string) => {
		asked.push(orgId);
		return answers[orgId] ?? null;
	};
	return { asked, fetchEntries };
}

describe("discussion threads", () => {
	it("are grouped by request", () => {
		const threads = byRequest([entry("a", "1"), entry("b", "2"), entry("c", "1")]);
		expect(Object.keys(threads)).toEqual(["1", "2"]);
		expect(threads["1"]?.map((e) => e.id)).toEqual(["a", "c"]);
	});

	it("are read once and not again within half a minute", async () => {
		let now = 1_000_000;
		const { asked, fetchEntries } = server({ ORG: [entry("a", "1")] });
		const threads = new DiscussionThreads(fetchEntries, () => now);

		expect(await threads.load(["ORG"])).toEqual({ changed: true, complete: true });
		expect(threads.of("ORG")?.["1"]?.[0]?.id).toBe("a");

		now += DISCUSSIONS_FRESH_MS - 1;
		expect(await threads.load(["ORG"])).toEqual({ changed: false, complete: true });
		now += 2;
		await threads.load(["ORG"]);
		expect(asked).toEqual(["ORG", "ORG"]);
	});

	it("report what couldn't be read and keep what was there", async () => {
		const { fetchEntries } = server({ GOOD: [entry("a", "1")], DOWN: null });
		const threads = new DiscussionThreads(fetchEntries, () => 1_000_000);
		threads.remember("DOWN", byRequest([entry("old", "9")]));

		expect(await threads.load(["GOOD", "DOWN"])).toEqual({ changed: true, complete: false });
		expect(threads.of("DOWN")?.["9"]?.[0]?.id).toBe("old");
	});

	it("from an earlier visit are shown and read again by the first screen", async () => {
		const { asked, fetchEntries } = server({ ORG: [] });
		const threads = new DiscussionThreads(fetchEntries, () => 1_000_000);
		threads.remember("ORG", byRequest([entry("old", "9")]));
		expect(threads.of("ORG")?.["9"]).toHaveLength(1);
		await threads.load(["ORG"]);
		expect(asked).toEqual(["ORG"]);
		expect(threads.of("ORG")).toEqual({});
	});

	it("take a write's answer without asking the server again", async () => {
		const { asked, fetchEntries } = server({ ORG: [] });
		const threads = new DiscussionThreads(fetchEntries, () => 1_000_000);
		threads.set("ORG", [entry("mine", "3")]);
		await threads.load(["ORG"]);
		expect(asked).toEqual([]);
		expect(threads.of("ORG")?.["3"]?.[0]?.id).toBe("mine");
	});
});
