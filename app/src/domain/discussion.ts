import { err, ok, type Result } from "./result.ts";
import { type Org, type PersonId, type RuleError, ruleError } from "./rules/model.ts";
import type { ApprovalRequest } from "./rules/requests.ts";

// Discussion on an approval request: reasons for and against, questions, comments, and
// thumbs up or down on them. Posting never counts as approving; the approval rules stay as
// they are. Pure functions here, storage behind the data source.

export type EntryKind = "pro" | "contra" | "question" | "comment";
export type Reaction = "up" | "down";

export type DiscussionEntry = {
	id: string;
	requestId: string;
	authorId: PersonId;
	at: number;
	kind: EntryKind;
	text: string;
	/** Questions can be marked answered by the requester. */
	answered: boolean;
	/** One reaction per person, changeable. */
	reactions: Readonly<Record<PersonId, Reaction>>;
};

export type DiscussionSummary = {
	pro: number;
	contra: number;
	openQuestions: number;
	comments: number;
	total: number;
};

export const MAX_ENTRY_LENGTH = 500;

export const KIND_LABELS: Readonly<Record<EntryKind, string>> = {
	pro: "Pro",
	contra: "Contra",
	question: "Question",
	comment: "Comment",
};

export const KINDS: readonly EntryKind[] = ["pro", "contra", "question", "comment"];

export function isEntryKind(value: unknown): value is EntryKind {
	return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

export function summarize(entries: readonly DiscussionEntry[]): DiscussionSummary {
	return {
		pro: entries.filter((e) => e.kind === "pro").length,
		contra: entries.filter((e) => e.kind === "contra").length,
		openQuestions: entries.filter((e) => e.kind === "question" && !e.answered).length,
		comments: entries.filter((e) => e.kind === "comment").length,
		total: entries.length,
	};
}

/** "2 pro · 1 contra · 1 open question", or null when nothing was said. */
export function describeSummary(summary: DiscussionSummary): string | null {
	if (summary.total === 0) return null;
	const parts: string[] = [];
	if (summary.pro > 0) parts.push(`${summary.pro} pro`);
	if (summary.contra > 0) parts.push(`${summary.contra} contra`);
	if (summary.openQuestions > 0) {
		parts.push(`${summary.openQuestions} open question${summary.openQuestions === 1 ? "" : "s"}`);
	}
	if (summary.comments > 0) {
		parts.push(`${summary.comments} comment${summary.comments === 1 ? "" : "s"}`);
	}
	return parts.join(" · ");
}

export function validateEntryText(text: string): Result<string, RuleError> {
	const trimmed = text.trim();
	if (!trimmed) return err(ruleError("not-allowed", "Write something first."));
	if (trimmed.length > MAX_ENTRY_LENGTH) {
		return err(ruleError("not-allowed", `Keep it under ${MAX_ENTRY_LENGTH} characters.`));
	}
	return ok(trimmed);
}

/** Members of the organization take part; posting never counts as an approval. */
export function canPost(org: Org, personId: PersonId): boolean {
	return org.members.some((m) => m.personId === personId);
}

/** One reaction per person, never on your own entry. */
export function canReact(entry: DiscussionEntry, personId: PersonId): boolean {
	return entry.authorId !== personId;
}

/** The requester closes questions on their own request. */
export function canMarkAnswered(
	request: ApprovalRequest,
	entry: DiscussionEntry,
	personId: PersonId,
): boolean {
	return entry.kind === "question" && !entry.answered && request.requesterId === personId;
}

export function reactionCounts(entry: DiscussionEntry): { up: number; down: number } {
	const values = Object.values(entry.reactions);
	return {
		up: values.filter((r) => r === "up").length,
		down: values.filter((r) => r === "down").length,
	};
}

/** Sets, changes or (with null) clears a person's reaction. */
export function withReaction(
	entry: DiscussionEntry,
	personId: PersonId,
	reaction: Reaction | null,
): DiscussionEntry {
	const reactions = { ...entry.reactions };
	if (reaction === null) delete reactions[personId];
	else reactions[personId] = reaction;
	return { ...entry, reactions };
}
