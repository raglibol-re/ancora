import { describe, expect, it } from "vitest";
import {
	canMarkAnswered,
	canReact,
	type DiscussionEntry,
	describeSummary,
	reactionCounts,
	summarize,
	validateEntryText,
	withReaction,
} from "./discussion.ts";
import type { ApprovalRequest } from "./rules/requests.ts";

const entry = (overrides: Partial<DiscussionEntry>): DiscussionEntry => ({
	id: "e1",
	requestId: "r1",
	authorId: "bo",
	at: 0,
	kind: "comment",
	text: "x",
	answered: false,
	reactions: {},
	...overrides,
});

describe("discussion", () => {
	it("summarizes reasons, open questions and comments", () => {
		const summary = summarize([
			entry({ kind: "pro" }),
			entry({ kind: "pro" }),
			entry({ kind: "contra" }),
			entry({ kind: "question" }),
			entry({ kind: "question", answered: true }),
			entry({ kind: "comment" }),
		]);
		expect(summary).toEqual({ pro: 2, contra: 1, openQuestions: 1, comments: 1, total: 6 });
		expect(describeSummary(summary)).toBe("2 pro · 1 contra · 1 open question · 1 comment");
		expect(describeSummary(summarize([]))).toBeNull();
	});

	it("allows one reaction per person, changeable, never on your own entry", () => {
		const own = entry({ authorId: "bo" });
		expect(canReact(own, "bo")).toBe(false);
		expect(canReact(own, "bea")).toBe(true);
		let reacted = withReaction(own, "bea", "up");
		reacted = withReaction(reacted, "max", "down");
		expect(reactionCounts(reacted)).toEqual({ up: 1, down: 1 });
		reacted = withReaction(reacted, "bea", "down");
		expect(reactionCounts(reacted)).toEqual({ up: 0, down: 2 });
		reacted = withReaction(reacted, "bea", null);
		expect(reactionCounts(reacted)).toEqual({ up: 0, down: 1 });
	});

	it("lets only the requester close an open question", () => {
		const request = { requesterId: "tess" } as ApprovalRequest;
		expect(canMarkAnswered(request, entry({ kind: "question" }), "tess")).toBe(true);
		expect(canMarkAnswered(request, entry({ kind: "question" }), "bo")).toBe(false);
		expect(canMarkAnswered(request, entry({ kind: "question", answered: true }), "tess")).toBe(
			false,
		);
		expect(canMarkAnswered(request, entry({ kind: "pro" }), "tess")).toBe(false);
	});

	it("refuses empty and oversized text", () => {
		expect(validateEntryText("  ")).toMatchObject({ ok: false });
		expect(validateEntryText("x".repeat(501))).toMatchObject({ ok: false });
		expect(validateEntryText("  fine ")).toEqual({ ok: true, value: "fine" });
	});
});
