import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../adapters/sample/seedWorkspace.ts";
import {
	decimal,
	filterItems,
	monthOf,
	type StatementFilter,
	statementCsv,
	statementItems,
	statementMonths,
	statementRows,
	totalsByAsset,
} from "./statement.ts";

const now = Date.UTC(2026, 9, 25, 12);

describe("statement", () => {
	it("prints minor units as decimals without floats", () => {
		expect(decimal(125050)).toBe("1250.50");
		expect(decimal(-5)).toBe("-0.05");
		expect(decimal(0)).toBe("0.00");
	});

	it("lists money movements oldest first with references and categories", () => {
		const account = seedWorkspace(now).accounts.find((a) => a.org.id === "tejo-rowing");
		if (!account) throw new Error("sample club missing");
		const rows = statementRows(account, {
			person: (id) => `person:${id}`,
			payee: (id) => `payee:${id}`,
		});
		expect(rows.length).toBeGreaterThan(2);
		for (let i = 1; i < rows.length; i++) {
			expect((rows[i - 1]?.date ?? "") <= (rows[i]?.date ?? "")).toBe(true);
		}
		const repairs = rows.find((r) => r.reference.startsWith("Hull repairs"));
		expect(repairs).toMatchObject({
			type: "payment",
			amount: "-640.00",
			currency: "EUR",
			category: "equipment",
			counterparty: "payee:boat-supplies",
		});
		expect(rows.some((r) => r.type === "change")).toBe(false);
	});

	it("quotes CSV cells that need it", () => {
		const csv = statementCsv([
			{
				date: "2026-10-25T12:00:00.000Z",
				type: "payment",
				amount: "-1.00",
				currency: "EUR",
				asset: "EURC",
				counterparty: 'Studio "Luz", Lda',
				reference: "a, b",
				category: "",
				by: "Inês",
				transaction: "",
			},
		]);
		expect(csv.split("\r\n")[0]).toBe(
			"date,type,amount,currency,asset,counterparty,reference,category,by,transaction",
		);
		expect(csv).toContain('"Studio ""Luz"", Lda","a, b"');
	});
});

describe("search and monthly totals", () => {
	const account = seedWorkspace(now).accounts.find((a) => a.org.id === "tejo-rowing");
	if (!account) throw new Error("sample club missing");
	const items = statementItems(account, {
		person: (id) => `person:${id}`,
		payee: (id) => (id === "boat-supplies" ? "Lisbon Boat Supplies" : id),
	});
	const all: StatementFilter = { query: "", direction: "all", token: null, month: null };

	it("finds movements by any word, case-insensitive", () => {
		const found = filterItems(items, { ...all, query: "hull LISBON" });
		expect(found.map((i) => i.row.reference)).toEqual([expect.stringMatching(/^Hull repairs/)]);
		expect(filterItems(items, { ...all, query: "-640.00" })).toHaveLength(1);
		expect(filterItems(items, { ...all, query: "nothing like this" })).toEqual([]);
	});

	it("filters by direction, asset and month", () => {
		const out = filterItems(items, { ...all, direction: "out" });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((i) => i.cents < 0 && i.row.type === "payment")).toBe(true);
		expect(filterItems(items, { ...all, direction: "in" }).every((i) => i.cents > 0)).toBe(true);
		const month = statementMonths(items)[0] ?? "";
		expect(month).toMatch(/^\d{4}-\d{2}$/);
		expect(filterItems(items, { ...all, month }).every((i) => monthOf(i.at) === month)).toBe(true);
		const token = items[0]?.token ?? "";
		expect(filterItems(items, { ...all, token }).every((i) => i.token === token)).toBe(true);
	});

	it("totals money in and out per asset, leaving Reserve moves out", () => {
		const totals = totalsByAsset(items);
		for (const t of totals) expect(t.net).toBe(t.moneyIn - t.moneyOut);
		const reserveOnly = items.filter((i) => i.row.type === "to reserve");
		for (const t of totalsByAsset(reserveOnly)) {
			expect(t).toMatchObject({ moneyIn: 0, moneyOut: 0, net: 0 });
		}
	});
});
