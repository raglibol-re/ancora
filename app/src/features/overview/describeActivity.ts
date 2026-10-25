import type { ActivityEntry, OrgAccount } from "../../domain/account.ts";
import { describeChange } from "../requests/describe.ts";

export function describeActivity(
	account: OrgAccount,
	entry: ActivityEntry,
	nameOf: (personId: string) => string,
): string {
	switch (entry.kind) {
		case "payment-out":
			return `Payment to ${account.payees.find((p) => p.id === entry.payeeId)?.name ?? "recipient"}`;
		case "deposit":
			return `Received: ${entry.from}`;
		case "reserve-in":
			return "Moved to the Reserve";
		case "reserve-out":
			return "Moved from the Reserve";
		case "earnings":
			return "Reserve earnings (variable)";
		case "governance":
			return `${describeChange(account.org, entry.change, nameOf)}${entry.viaRequest ? " (approved)" : " (setup)"}`;
		case "logo":
			return "Logo updated";
	}
}
