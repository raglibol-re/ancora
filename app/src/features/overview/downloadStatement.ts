import type { OrgAccount } from "../../domain/account.ts";
import { type StatementItem, statementCsv, statementItems } from "../../domain/statement.ts";

/** Hands a CSV to the browser as a download named after the organization and `suffix`. */
export function saveCsv(account: OrgAccount, csv: string, suffix: string): void {
	const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${account.org.name.replace(/[^\w-]+/g, "-").toLowerCase()}-statement-${suffix}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * Builds the organization's whole statement, with `extra` movements (the confidential pot's
 * private payments) in date order, and hands it to the browser as a CSV download.
 */
export function downloadStatement(
	account: OrgAccount,
	personName: (id: string) => string,
	extra: readonly StatementItem[] = [],
): void {
	const items = statementItems(account, {
		person: personName,
		payee: (id) => account.payees.find((p) => p.id === id)?.name ?? id,
	});
	const rows = [...items, ...extra].sort((a, b) => a.at - b.at).map((item) => item.row);
	saveCsv(account, statementCsv(rows), "all");
}
