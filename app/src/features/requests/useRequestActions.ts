import type { OrgAccount } from "../../domain/account.ts";
import { availableActions } from "../../domain/inbox.ts";
import type { ApprovalRequest } from "../../domain/rules/requests.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { requestTitle } from "./describe.ts";

/**
 * Approve / seal / decline / send for the current person, each behind the matching signature
 * prompt. "Send" exists only where a signer must sign the on-chain transfer (testnet).
 */
export function useRequestActions(account: OrgAccount, request: ApprovalRequest) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const signers = account.onchain?.signers ?? [];
	const awaitingSignature =
		dataSource.payments === "manual" && request.kind === "payment" && request.status === "ready";
	const allowed = {
		...availableActions(account.org, request, me.id),
		send: awaitingSignature && signers.some((s) => s.personId === me.id),
	};
	const title = requestTitle(account, request, personName);
	const orgId = account.org.id;

	return {
		allowed,
		busy,
		/** Who can sign and send, when the payment is waiting for an on-chain signature. */
		awaitingSignatureFrom: awaitingSignature ? signers.map((s) => personName(s.personId)) : [],
		send: () =>
			run(() => dataSource.executeRequest(orgId, request.id, me.id), {
				success: "Sent. The payment is confirmed on Stellar.",
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
