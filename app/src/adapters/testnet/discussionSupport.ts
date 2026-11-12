import type { DiscussionSupport } from "../../domain/dataSource.ts";
import type { DiscussionEntry } from "../../domain/discussion.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import type { DiscussionThreads } from "./discussionThreads.ts";
import { postToServer } from "./serverRoutes.ts";

// Discussions on requests, kept on ancora's server (they are not on-chain).

type Deps = {
	threads: DiscussionThreads;
	/** Whether the organization has any request; a discussion hangs on one. */
	hasRequests: (orgId: string) => boolean;
	/** Puts the threads read so far into the workspace on screen. */
	show: () => void;
	/** A note as it is stored: encrypted when the organization keeps references private. */
	protectNote: (
		orgId: string,
		actorId: PersonId,
		text: string,
		onChain: boolean,
	) => Promise<Result<string, RuleError>>;
	failed: (message: string) => Result<never, RuleError>;
};

export function createDiscussionSupport(deps: Deps): DiscussionSupport {
	const { threads } = deps;

	/** A change to a discussion; the server answers with the organization's threads afterwards. */
	const change = async (
		body: Record<string, unknown> & { org: string },
	): Promise<Result<void, RuleError>> => {
		const response = await postToServer<{ entries: DiscussionEntry[] }>("/api/discussions", body);
		if (!response.ok) return response;
		threads.set(body.org, response.value.entries);
		deps.show();
		return ok(undefined);
	};

	return {
		/** Reads the organizations' discussions, unless they were read a moment ago. */
		load: async (orgIds) => {
			const { changed, complete } = await threads.load(orgIds.filter(deps.hasRequests));
			if (changed) deps.show();
			return complete
				? ok(undefined)
				: deps.failed("The discussion couldn't be loaded from ancora's server. Try again shortly.");
		},
		post: async (orgId, requestId, actorId, entry) => {
			const text = await deps.protectNote(orgId, actorId, entry.text, false);
			if (!text.ok) return text;
			return change({
				action: "post",
				org: orgId,
				requestId,
				person: actorId,
				...entry,
				text: text.value,
			});
		},
		react: (orgId, requestId, entryId, actorId, reaction) =>
			change({ action: "react", org: orgId, requestId, entryId, person: actorId, reaction }),
		markAnswered: (orgId, requestId, entryId, actorId) =>
			change({ action: "answer", org: orgId, requestId, entryId, person: actorId }),
	};
}
