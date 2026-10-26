import { accountsOf, type OrgAccount, type Workspace } from "./account.ts";
import type { Org, PersonId } from "./rules/model.ts";
import {
	type ApprovalRequest,
	approveRequest,
	cancelEscrow,
	confirmEscrow,
	declineRequest,
	sealRequest,
} from "./rules/requests.ts";

export type RequestActions = {
	approve: boolean;
	seal: boolean;
	decline: boolean;
	/** The sender's side may confirm the release of a held handover. */
	confirmEscrow: boolean;
	cancelEscrow: boolean;
};

/**
 * What this person may do with a request right now. Dry-runs the real lifecycle functions so the
 * UI can never offer an action the engine would refuse.
 */
export function availableActions(
	org: Org,
	request: ApprovalRequest,
	personId: PersonId,
): RequestActions {
	return {
		approve: approveRequest(org, request, personId, request.createdAt).ok,
		seal: sealRequest(org, request, personId, request.createdAt).ok,
		decline: declineRequest(org, request, personId).ok,
		confirmEscrow:
			request.kind === "payment" &&
			request.status === "escrowed" &&
			!request.escrowConfirmed?.sender &&
			personId !== request.recipientId &&
			confirmEscrow(org, request, personId).ok,
		cancelEscrow: cancelEscrow(org, request, personId).ok,
	};
}

export type InboxItem = {
	account: OrgAccount;
	request: ApprovalRequest;
	actions: RequestActions;
};

/** Requests across all of this person's organizations that they can still approve or seal. */
export function inboxFor(workspace: Workspace, personId: PersonId): InboxItem[] {
	return accountsOf(workspace, personId)
		.flatMap((account) =>
			account.requests.map((request) => ({
				account,
				request,
				actions: availableActions(account.org, request, personId),
			})),
		)
		.filter((item) => item.actions.approve || item.actions.seal)
		.sort((a, b) => b.request.createdAt - a.request.createdAt);
}
