import type { OrgAccount } from "../../domain/account.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ExpertDetails.module.css";

/** Technical references for expert mode. Testnet mode (task 4+) adds contract and transaction links. */
export function ExpertDetails({
	account,
	request,
}: {
	account: OrgAccount;
	request: ApprovalRequest;
}) {
	const { dataSource } = useWorkspace();
	const sample = dataSource.kind === "sample";

	return (
		<Card title="Expert details" action={sample ? <SimulatedTag /> : null}>
			<dl className={styles.list}>
				<dt>Request ID</dt>
				<dd>{request.id}</dd>
				<dt>Organization ID</dt>
				<dd>{account.org.id}</dd>
				<dt>Rule tier</dt>
				<dd>
					{request.evaluation.withinLimit
						? "Within the requester's spending limit (no tier)"
						: request.evaluation.tierIndex === null
							? "Strictest tier (membership or rule change)"
							: `Tier ${request.evaluation.tierIndex + 1} of ${account.org.policy.tiers.length}`}
				</dd>
				{account.onchain && (
					<>
						<dt>Smart account</dt>
						<dd>
							<ExplorerLink target={account.onchain.contractId}>
								{account.onchain.contractId}
							</ExplorerLink>
						</dd>
					</>
				)}
				<dt>On-chain reference</dt>
				<dd>
					{request.executionRef ? (
						<ExplorerLink target={request.executionRef}>{request.executionRef}</ExplorerLink>
					) : sample ? (
						"None: this is sample data, nothing was sent to the Stellar testnet."
					) : (
						"Not sent yet. Approvals are recorded in the app until the rules move on-chain."
					)}
				</dd>
			</dl>
		</Card>
	);
}
