import { Link } from "react-router";
import { discussionOf, type OrgAccount } from "../../domain/account.ts";
import { describeSummary, summarize } from "../../domain/discussion.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatRelative } from "../../ui/format.ts";
import { useNotify } from "../notices/NoticeContext.ts";
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
	const { personName, me, dataSource } = useWorkspace();
	const notify = useNotify();
	const {
		allowed,
		busy,
		approve,
		seal,
		decline,
		send,
		confirmEscrow,
		cancelEscrow,
		simulateRecipient,
	} = useRequestActions(account, request);
	const escrowLink = `${window.location.origin}/app/escrow/${encodeURIComponent(account.org.id)}/${encodeURIComponent(request.id)}`;
	const copyEscrowLink = async () => {
		try {
			await navigator.clipboard.writeText(escrowLink);
			notify({ tone: "success", text: "Link copied. Send it to the recipient to confirm." });
		} catch {
			notify({ tone: "error", text: `Couldn't copy. The link is ${escrowLink}` });
		}
	};
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
			{request.kind === "payment" && (request.note || request.category) && (
				<p className={styles.note}>
					{request.note}
					{request.category && `${request.note ? " · " : ""}#${request.category}`}
					{request.evaluation.overBudget && " · over budget"}
				</p>
			)}
			{discussion && (
				<Link to={`/app/approvals/${request.id}`} className={styles.meta}>
					Discussion: {discussion}
				</Link>
			)}
			<RequestProgress account={account} request={request} />
			{request.kind === "payment" && request.escrow && (
				<p className={styles.meta}>
					Secure handover: approved and set aside, paid out once both sides confirm.
					{request.escrowConfirmed &&
						` Recipient ${request.escrowConfirmed.recipient ? "confirmed" : "not yet"} · ${account.org.name} ${request.escrowConfirmed.sender ? "confirmed" : "not yet"}.`}
				</p>
			)}
			{request.executionRef && <ExplorerLink target={request.executionRef} />}
			{request.kind === "payment" && request.status === "escrowed" && (
				<div className={styles.actions}>
					{allowed.confirmEscrow && (
						<button type="button" className={buttonClass()} onClick={confirmEscrow} disabled={busy}>
							Confirm release
						</button>
					)}
					<button type="button" className={buttonClass("secondary")} onClick={copyEscrowLink}>
						Copy link for the recipient
					</button>
					{dataSource.kind === "sample" && !request.escrowConfirmed?.recipient && (
						<button
							type="button"
							className={buttonClass("secondary")}
							onClick={simulateRecipient}
							disabled={busy}
						>
							Simulate recipient confirmation
						</button>
					)}
					{allowed.cancelEscrow && (
						<button
							type="button"
							className={buttonClass("secondary")}
							onClick={cancelEscrow}
							disabled={busy}
						>
							Cancel handover
						</button>
					)}
				</div>
			)}
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
