import { type ActivityEntry, type OrgAccount, shortAddress } from "../../domain/account.ts";
import { describeChange } from "../requests/describe.ts";

export function describeActivity(
	account: OrgAccount,
	entry: ActivityEntry,
	nameOf: (personId: string) => string,
): string {
	switch (entry.kind) {
		case "payment-out":
			return `Payment to ${account.payees.find((p) => p.id === entry.payeeId)?.name ?? label(account, entry.payeeId)}`;
		case "deposit":
			return entry.from === entry.token
				? "Received from the issuer"
				: `Received from ${label(account, entry.from)}`;
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

/** A payee's name when the address is known, otherwise the address shortened. */
function label(account: OrgAccount, idOrAddress: string): string {
	const payee = account.payees.find((p) => p.account === idOrAddress || p.id === idOrAddress);
	if (payee) return payee.name;
	return idOrAddress.length > 20 ? shortAddress(idOrAddress) : idOrAddress;
}
