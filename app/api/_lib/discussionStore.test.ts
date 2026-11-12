import { describe, expect, it } from "vitest";
import { entryOf, newEntryId } from "./discussionStore.js";

describe("discussion rows", () => {
	it("become entries with the time as a number and only real reactions", () => {
		expect(
			entryOf({
				id: "a1",
				request_id: "7",
				author_id: "CAUTHOR",
				at: "1794500000000",
				kind: "question",
				body: "Why this supplier?",
				answered: true,
				reactions: { CMEMBER: "up", COTHER: "sideways" },
			}),
		).toEqual({
			id: "a1",
			requestId: "7",
			authorId: "CAUTHOR",
			at: 1_794_500_000_000,
			kind: "question",
			text: "Why this supplier?",
			answered: true,
			reactions: { CMEMBER: "up" },
		});
	});

	it("have no reactions when nobody reacted", () => {
		const row = { id: "a", request_id: "1", author_id: "C", at: "1", kind: "pro", body: "x" };
		expect(entryOf({ ...row, answered: false, reactions: {} }).reactions).toEqual({});
		expect(entryOf({ ...row, answered: false, reactions: null }).reactions).toEqual({});
	});
});

describe("entry ids", () => {
	it("sort by the time they were made", () => {
		expect(newEntryId(1_794_500_000_000) < newEntryId(1_794_500_000_001)).toBe(true);
	});
});
