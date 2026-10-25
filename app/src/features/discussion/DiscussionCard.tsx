import { type FormEvent, useState } from "react";
import { discussionOf, type OrgAccount } from "../../domain/account.ts";
import {
	canMarkAnswered,
	canPost,
	canReact,
	type DiscussionEntry,
	describeSummary,
	type EntryKind,
	KIND_LABELS,
	KINDS,
	MAX_ENTRY_LENGTH,
	type Reaction,
	reactionCounts,
	summarize,
	validateEntryText,
} from "../../domain/discussion.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatRelative } from "../../ui/format.ts";
import { Segmented } from "../../ui/Segmented.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./DiscussionCard.module.css";

/**
 * Reasons for and against, questions and comments on a request, with thumbs up or down.
 * Members only; posting never counts as approving.
 */
export function DiscussionCard({
	account,
	request,
}: {
	account: OrgAccount;
	request: ApprovalRequest;
}) {
	const { dataSource, me, personOf } = useWorkspace();
	const { run, busy } = useCommand();
	const entries = discussionOf(account, request.id);
	const summary = describeSummary(summarize(entries));
	const [kind, setKind] = useState<EntryKind>("pro");
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const member = canPost(account.org, me.id);
	const orgId = account.org.id;

	const post = async (event: FormEvent) => {
		event.preventDefault();
		const valid = validateEntryText(text);
		if (!valid.ok) {
			setError(valid.error.message);
			return;
		}
		setError(null);
		const result = await run(
			() => dataSource.discussions.post(orgId, request.id, me.id, { kind, text: valid.value }),
			{ success: kind === "question" ? "Question posted." : "Posted." },
		);
		if (result?.ok) setText("");
	};

	const react = (entry: DiscussionEntry, reaction: Reaction) => {
		const next = entry.reactions[me.id] === reaction ? null : reaction;
		return run(() => dataSource.discussions.react(orgId, request.id, entry.id, me.id, next));
	};

	const answer = (entry: DiscussionEntry) =>
		run(() => dataSource.discussions.markAnswered(orgId, request.id, entry.id, me.id), {
			success: "Marked as answered.",
		});

	return (
		<Card
			title="Discussion"
			action={summary ? <span className={styles.summary}>{summary}</span> : null}
		>
			<p className={styles.muted}>
				Reasons for and against, questions and comments help approvers decide. Taking part here
				doesn't count as an approval.
			</p>
			{entries.length > 0 && (
				<ul className={styles.list}>
					{entries.map((entry) => {
						const author = personOf(entry.authorId);
						const counts = reactionCounts(entry);
						const mine = entry.reactions[me.id];
						return (
							<li key={entry.id} className={styles.entry}>
								<Avatar name={author.name} imageUrl={author.avatarUrl} size="sm" shape="circle" />
								<div className={styles.body}>
									<div className={styles.head}>
										<span className={`${styles.kind} ${styles[entry.kind]}`}>
											{KIND_LABELS[entry.kind]}
											{entry.kind === "question" && (entry.answered ? " · answered" : " · open")}
										</span>
										<span className={styles.muted}>
											{author.name} · {formatRelative(entry.at, Date.now())}
										</span>
									</div>
									<p className={styles.text}>{entry.text}</p>
									<div className={styles.reactions}>
										<button
											type="button"
											className={`${styles.reaction} ${mine === "up" ? styles.active : ""}`}
											disabled={busy || !member || !canReact(entry, me.id)}
											aria-pressed={mine === "up"}
											aria-label="Thumbs up"
											onClick={() => react(entry, "up")}
										>
											👍 {counts.up}
										</button>
										<button
											type="button"
											className={`${styles.reaction} ${mine === "down" ? styles.active : ""}`}
											disabled={busy || !member || !canReact(entry, me.id)}
											aria-pressed={mine === "down"}
											aria-label="Thumbs down"
											onClick={() => react(entry, "down")}
										>
											👎 {counts.down}
										</button>
										{canMarkAnswered(request, entry, me.id) && (
											<button
												type="button"
												className={styles.linkButton}
												disabled={busy}
												onClick={() => answer(entry)}
											>
												Mark as answered
											</button>
										)}
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}
			{member ? (
				<form className={styles.form} onSubmit={post}>
					<Segmented<EntryKind>
						label="Kind"
						value={kind}
						onChange={setKind}
						options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
					/>
					<Field
						label={kind === "question" ? "Your question" : "Your point"}
						htmlFor="discussion-text"
						error={error}
						hint={`Up to ${MAX_ENTRY_LENGTH} characters. Visible to the organization's members.`}
					>
						<textarea
							id="discussion-text"
							className={`${controlClass} ${styles.textarea}`}
							rows={3}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
					</Field>
					<div>
						<button
							type="submit"
							className={buttonClass("secondary")}
							disabled={busy || !text.trim()}
						>
							Post
						</button>
					</div>
				</form>
			) : (
				<p className={styles.muted}>Only members of the organization can take part.</p>
			)}
		</Card>
	);
}
