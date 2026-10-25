import { type ActivityEntry, balanceEffect, currencyOf, type OrgAccount } from "./account.ts";
import { categoryOf } from "./budgets.ts";
import type { Cents } from "./money.ts";

// The bookkeeping statement: every movement of money as a row, built from what the organization
// already has: executed payment requests (with their reference) and the rest of the activity.
// Amounts leave as signed decimals made from minor units here, at the export edge, never floats.

export type StatementRow = {
	date: string;
	type: string;
	amount: string;
	currency: string;
	asset: string;
	counterparty: string;
	reference: string;
	category: string;
	by: string;
	transaction: string;
};

const HEADER: (keyof StatementRow)[] = [
	"date",
	"type",
	"amount",
	"currency",
	"asset",
	"counterparty",
	"reference",
	"category",
	"by",
	"transaction",
];

/** "-1250.50" from -125050 cents, without going through floating point. */
export function decimal(cents: Cents): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const TYPE: Partial<Record<ActivityEntry["kind"], string>> = {
	deposit: "deposit",
	"reserve-in": "to reserve",
	"reserve-out": "from reserve",
	earnings: "reserve earnings",
};

type Names = { person: (id: string) => string; payee: (id: string) => string };

/** Money movements only, oldest first; governance and logo changes aren't money. */
export function statementRows(account: OrgAccount, names: Names): StatementRow[] {
	const symbols = new Map(account.org.assets.map((a) => [a.token, a.symbol]));
	const payments = account.requests.flatMap((request) => {
		if (request.kind !== "payment" || request.status !== "executed") return [];
		return [
			{
				at: request.createdAt,
				row: {
					date: new Date(request.createdAt).toISOString(),
					type: "payment",
					amount: decimal(-request.amount),
					currency: request.currency,
					asset: symbols.get(request.token) ?? request.token,
					counterparty: names.payee(request.recipientId),
					reference: request.note,
					category: categoryOf(request.note) ?? "",
					by: names.person(request.requesterId),
					transaction: request.executionRef ?? "",
				},
			},
		];
	});
	const movements = account.activity.flatMap((entry) => {
		const type = TYPE[entry.kind];
		if (!type || !("amount" in entry)) return [];
		return [
			{
				at: entry.at,
				row: {
					date: new Date(entry.at).toISOString(),
					type,
					amount: decimal(entry.kind === "earnings" ? entry.amount : balanceEffect(entry)),
					currency: currencyOf(account, entry.token),
					asset: symbols.get(entry.token) ?? entry.token,
					counterparty: entry.kind === "deposit" ? entry.from : "",
					reference: "",
					category: "",
					by: entry.actorId ? names.person(entry.actorId) : "",
					transaction: "txHash" in entry ? (entry.txHash ?? "") : "",
				},
			},
		];
	});
	return [...payments, ...movements].sort((a, b) => a.at - b.at).map((item) => item.row);
}

function csvCell(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** RFC 4180 CSV with a header row; opens in any spreadsheet. */
export function statementCsv(rows: readonly StatementRow[]): string {
	const lines = [
		HEADER.join(","),
		...rows.map((row) => HEADER.map((key) => csvCell(row[key])).join(",")),
	];
	return `${lines.join("\r\n")}\r\n`;
}
