import { type ActivityEntry, balanceEffect, currencyOf, type OrgAccount } from "./account.ts";
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

/** A statement row with what filters and totals need: time, signed amount, asset. */
export type StatementItem = { at: number; cents: Cents; token: string; row: StatementRow };

/** Money movements only, oldest first; governance and logo changes aren't money. */
export function statementRows(account: OrgAccount, names: Names): StatementRow[] {
	return statementItems(account, names).map((item) => item.row);
}

/** The same movements as `statementRows`, with their signed amount and asset kept as numbers. */
export function statementItems(account: OrgAccount, names: Names): StatementItem[] {
	const symbols = new Map(account.org.assets.map((a) => [a.token, a.symbol]));
	const payments = account.requests.flatMap((request) => {
		if (request.kind !== "payment" || request.status !== "executed") return [];
		return [
			{
				at: request.createdAt,
				cents: -request.amount,
				token: request.token,
				row: {
					date: new Date(request.createdAt).toISOString(),
					type: "payment",
					amount: decimal(-request.amount),
					currency: request.currency,
					asset: symbols.get(request.token) ?? request.token,
					counterparty: names.payee(request.recipientId),
					reference: request.note,
					category: request.category ?? "",
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
				cents: entry.kind === "earnings" ? entry.amount : balanceEffect(entry),
				token: entry.token,
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
	return [...payments, ...movements].sort((a, b) => a.at - b.at);
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

export type Direction = "all" | "in" | "out" | "reserve";

export type StatementFilter = {
	/** Matched against counterparty, reference, category, type, person and amount. */
	query: string;
	direction: Direction;
	/** One asset, or every asset. */
	token: string | null;
	/** "2026-10", or every month. */
	month: string | null;
};

/** "2026-10" for a moment, in UTC like the statement's dates. */
export function monthOf(at: number): string {
	return new Date(at).toISOString().slice(0, 7);
}

const RESERVE_TYPES = new Set(["to reserve", "from reserve", "reserve earnings"]);

export function filterItems(
	items: readonly StatementItem[],
	filter: StatementFilter,
): StatementItem[] {
	const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return items.filter((item) => {
		if (filter.token && item.token !== filter.token) return false;
		if (filter.month && monthOf(item.at) !== filter.month) return false;
		const reserve = RESERVE_TYPES.has(item.row.type);
		if (filter.direction === "reserve" && !reserve) return false;
		if (filter.direction === "in" && (reserve || item.cents <= 0)) return false;
		if (filter.direction === "out" && (reserve || item.cents >= 0)) return false;
		const haystack = Object.values(item.row).join(" ").toLowerCase();
		return words.every((word) => haystack.includes(word));
	});
}

/** The months that have movements, newest first. */
export function statementMonths(items: readonly StatementItem[]): string[] {
	return [...new Set(items.map((item) => monthOf(item.at)))].sort().reverse();
}

export type Totals = { token: string; moneyIn: Cents; moneyOut: Cents; net: Cents };

/**
 * Money in and out per asset for the given items. Reserve moves stay inside the organization,
 * so they count in neither direction (earnings do count as money in).
 */
export function totalsByAsset(items: readonly StatementItem[]): Totals[] {
	const totals = new Map<string, Totals>();
	for (const item of items) {
		const current = totals.get(item.token) ?? {
			token: item.token,
			moneyIn: 0,
			moneyOut: 0,
			net: 0,
		};
		if (item.row.type === "to reserve" || item.row.type === "from reserve") {
			totals.set(item.token, current);
			continue;
		}
		if (item.cents >= 0) current.moneyIn += item.cents;
		else current.moneyOut += -item.cents;
		current.net = current.moneyIn - current.moneyOut;
		totals.set(item.token, current);
	}
	return [...totals.values()];
}
