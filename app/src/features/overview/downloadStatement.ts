import type { OrgAccount } from "../../domain/account.ts";
import { statementCsv, statementRows } from "../../domain/statement.ts";

/** Builds the organization's statement and hands it to the browser as a CSV download. */
export function downloadStatement(account: OrgAccount, personName: (id: string) => string): void {
	const rows = statementRows(account, {
		person: personName,
		payee: (id) => account.payees.find((p) => p.id === id)?.name ?? id,
	});
	const file = new Blob([statementCsv(rows)], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${account.org.name.replace(/[^\w-]+/g, "-").toLowerCase()}-statement.csv`;
	link.click();
	URL.revokeObjectURL(url);
}
