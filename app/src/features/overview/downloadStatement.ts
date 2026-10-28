import type { OrgAccount } from "../../domain/account.ts";
import { statementCsv, statementRows } from "../../domain/statement.ts";

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

/** Builds the organization's whole statement and hands it to the browser as a CSV download. */
export function downloadStatement(account: OrgAccount, personName: (id: string) => string): void {
	const rows = statementRows(account, {
		person: personName,
		payee: (id) => account.payees.find((p) => p.id === id)?.name ?? id,
	});
	saveCsv(account, statementCsv(rows), "all");
}
