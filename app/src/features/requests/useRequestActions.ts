import type { OrgAccount } from "../../domain/account.ts";
import { availableActions } from "../../domain/inbox.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { requestTitle } from "./describe.ts";

/**
 * Approve / seal / decline / send for the current person, each behind the matching signature
 * prompt. "Send now" exists on testnet, where a fully approved request whose objection window
 * has passed waits for anyone to trigger its execution (the contract checks everything again).
 */
export function useRequestActions(account: OrgAccount, request: ApprovalRequest) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const allowed = {
		...availableActions(account.org, request, me.id),
		send: dataSource.kind === "testnet" && request.status === "ready",
	};
	const title = requestTitle(account, request, personName);
	const orgId = account.org.id;

	return {
		allowed,
		busy,
		send: () =>
			run(() => dataSource.executeRequest(orgId, request.id, me.id), {
				success:
					request.kind === "payment"
						? "Sent. The payment is confirmed on Stellar."
						: "Applied. The change is on Stellar.",
			}),
		approve: () =>
			run(() => dataSource.approve(orgId, request.id, me.id), {
				signature: { kind: "passkey", title: `Approve ${title}` },
				success: "Approved.",
			}),
		seal: () =>
			run(() => dataSource.seal(orgId, request.id, me.id), {
				signature: { kind: "seal", title: `Seal ${title}` },
				success: "Security seal added.",
			}),
		confirmEscrow: () =>
			run(() => dataSource.confirmEscrow(orgId, request.id, me.id), {
				signature: { kind: "passkey", title: `Release ${title}` },
				success: "Release confirmed. It goes out once the recipient has confirmed too.",
			}),
		cancelEscrow: () =>
			run(() => dataSource.cancelEscrow(orgId, request.id, me.id), {
				signature: { kind: "passkey", title: `Cancel the handover ${title}` },
				success: "Handover cancelled. The money is free again.",
			}),
		/** Sample data only: the recipient has no pass here, so their confirmation is simulated. */
		simulateRecipient: () =>
			run(
				() =>
					dataSource.confirmEscrow(
						orgId,
						request.id,
						request.kind === "payment" ? request.recipientId : me.id,
					),
				{ success: "Recipient confirmation simulated." },
			),
		decline: () =>
			run(() => dataSource.decline(orgId, request.id, me.id), {
				signature: {
					kind: "passkey",
					title: request.requesterId === me.id ? `Cancel ${title}` : `Decline ${title}`,
				},
				success:
					request.status === "scheduled" ? "Objection recorded. It won't go out." : "Declined.",
			}),
	};
}
