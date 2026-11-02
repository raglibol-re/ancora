import type { OrgAccount } from "./account.ts";
import type { PotRequest } from "./rules/requests.ts";

/**
 * A payment or withdrawal from the confidential pot still waiting to run. Its proof was made
 * against the pot's spendable balance as it was, so until it runs nothing may change that
 * balance: no other spend and no merge.
 */
export function pendingPotSpend(account: OrgAccount): PotRequest | null {
	for (const request of account.requests) {
		if (
			request.kind === "pot" &&
			(request.action.type === "pay" || request.action.type === "withdraw") &&
			(request.status === "pending" || request.status === "scheduled" || request.status === "ready")
		) {
			return request;
		}
	}
	return null;
}
