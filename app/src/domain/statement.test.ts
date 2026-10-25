import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../adapters/sample/seedWorkspace.ts";
import { decimal, statementCsv, statementRows } from "./statement.ts";

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
