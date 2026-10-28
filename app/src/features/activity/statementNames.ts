import { type OrgAccount, shortAddress } from "../../domain/account.ts";
import type { Currency } from "../../domain/money.ts";

/** Names for statement rows: people by name, recipients from the address book, full addresses. */
export function statementNames(account: OrgAccount, personName: (id: string) => string) {
	return {
		person: personName,
		payee: (id: string) => account.payees.find((p) => p.id === id || p.account === id)?.name ?? id,
	};
}

/** On screen a long address reads shortened; the CSV keeps it whole. */
export function displayParty(account: OrgAccount, value: string): string {
	const known = account.payees.find((p) => p.account === value)?.name;
	if (known) return known;
	return value.length > 24 && !value.includes(" ") ? shortAddress(value) : value;
}

export const asCurrency = (value: string): Currency => (value === "USD" ? "USD" : "EUR");

/** "October 2026" for "2026-10". */
export function monthLabel(month: string): string {
	const [year, index] = month.split("-").map(Number);
	return new Date(Date.UTC(year ?? 1970, (index ?? 1) - 1, 1)).toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}
