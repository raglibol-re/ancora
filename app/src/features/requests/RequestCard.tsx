import { Link } from "react-router";
import { discussionOf, type OrgAccount } from "../../domain/account.ts";
import { describeSummary, summarize } from "../../domain/discussion.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatRelative } from "../../ui/format.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { requestTitle } from "./describe.ts";
import styles from "./RequestCard.module.css";
import { RequestProgress } from "./RequestProgress.tsx";
import { StatusPill } from "./StatusPill.tsx";
import { useRequestActions } from "./useRequestActions.ts";

type RequestCardProps = {
	account: OrgAccount;
	request: ApprovalRequest;
	/** Show which organization it belongs to (cross-org inbox). */
	showOrg?: boolean;
};

export function RequestCard({ account, request, showOrg = false }: RequestCardProps) {
	const { personName, me } = useWorkspace();
	const { allowed, busy, approve, seal, decline, send } = useRequestActions(account, request);
	const title = requestTitle(account, request, personName);
	const requester = request.requesterId === me.id ? "you" : personName(request.requesterId);
	const discussion = describeSummary(summarize(discussionOf(account, request.id)));

	return (
		<article className={styles.card}>
			<header className={styles.header}>
				{showOrg && <Avatar name={account.org.name} imageUrl={account.logoUrl} size="sm" />}
				<div className={styles.heading}>
					{showOrg && <span className={styles.org}>{account.org.name}</span>}
					<Link to={`/app/approvals/${request.id}`} className={styles.title}>
						{title}
					</Link>
					<span className={styles.meta}>
						Requested by {requester} · {formatRelative(request.createdAt, Date.now())}
						{request.kind === "payment" && request.recipientIsNew && " · new recipient"}
					</span>
				</div>
				<StatusPill status={request.status} />
			</header>
			{request.kind === "payment" && request.note && <p className={styles.note}>{request.note}</p>}
			{discussion && (
				<Link to={`/app/approvals/${request.id}`} className={styles.meta}>
					Discussion: {discussion}
				</Link>
			)}
			<RequestProgress account={account} request={request} />
			{request.executionRef && <ExplorerLink target={request.executionRef} />}
			{(allowed.approve || allowed.seal || allowed.decline || allowed.send) && (
				<div className={styles.actions}>
					{allowed.send && (
						<button type="button" className={buttonClass()} onClick={send} disabled={busy}>
							{request.kind === "payment" ? "Send now" : "Apply now"}
						</button>
					)}
					{allowed.approve && (
						<button type="button" className={buttonClass()} onClick={approve} disabled={busy}>
							Approve
						</button>
					)}
					{allowed.seal && (
						<button type="button" className={buttonClass()} onClick={seal} disabled={busy}>
							Add security seal
						</button>
					)}
					{allowed.decline && (
						<button
							type="button"
							className={buttonClass("secondary")}
							onClick={decline}
							disabled={busy}
						>
							{request.requesterId === me.id
								? "Cancel"
								: request.status === "scheduled"
									? "Object"
									: "Decline"}
						</button>
					)}
				</div>
			)}
		</article>
	);
}
