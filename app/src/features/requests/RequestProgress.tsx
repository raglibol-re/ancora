import type { OrgAccount } from "../../domain/account.ts";
import { approvalProgress } from "../../domain/rules/approvals.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { formatRelative } from "../../ui/format.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { roleLabel } from "./describe.ts";
import styles from "./RequestProgress.module.css";

/** Who has approved, what's missing, the seal and the objection window. */
export function RequestProgress({
	account,
	request,
}: {
	account: OrgAccount;
	request: ApprovalRequest;
}) {
	const { personName } = useWorkspace();
	const { org } = account;
	const progress = approvalProgress(
		org,
		request.evaluation.approvals,
		request.approvals.map((a) => a.personId),
		request.requesterId,
	);
	const now = Date.now();

	return (
		<ul className={styles.list}>
			{progress.slots.map((slot) => (
				<li
					key={slot.roleId}
					className={slot.approvedBy.length === slot.required ? styles.done : ""}
				>
					<span className={styles.count}>
						{slot.approvedBy.length}/{slot.required}
					</span>
					{roleLabel(org, slot.roleId, slot.required)}
					{slot.approvedBy.length > 0 && (
						<span className={styles.who}>{slot.approvedBy.map(personName).join(", ")}</span>
					)}
				</li>
			))}
			{request.evaluation.sealRequired && (
				<li className={request.sealedBy ? styles.done : ""}>
					<span className={styles.count}>{request.sealedBy ? "✓" : "–"}</span>
					Security seal
					{request.sealedBy && <span className={styles.who}>{personName(request.sealedBy)}</span>}
				</li>
			)}
			{request.status === "scheduled" && request.executeAfter !== null && (
				<li>
					<span className={styles.count}>⏱</span>
					Goes out {formatRelative(request.executeAfter, now)} unless someone objects
				</li>
			)}
			{request.status === "failed" && request.failure && (
				<li className={styles.failed}>{request.failure.message}</li>
			)}
			{request.status === "declined" && request.declinedBy && (
				<li className={styles.failed}>
					{request.declinedBy === request.requesterId ? "Cancelled" : "Declined"} by{" "}
					{personName(request.declinedBy)}
				</li>
			)}
		</ul>
	);
}
