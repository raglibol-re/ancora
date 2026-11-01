import { describe, expect, it } from "vitest";
import { parseBatchCsv } from "./batchImport.ts";
import { MAX_BATCH_LINES } from "./rules/requests.ts";

const G1 = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";
const G2 = "GBQG3EXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLE";
const payees = [{ name: "Ana Costa", account: G2 }];

describe("parseBatchCsv", () => {
	it("reads comma-separated rows with a header", () => {
		const result = parseBatchCsv(`recipient,amount,reference\n${G1},120.50,October\n`, payees);
		expect(result).toEqual({ ok: true, value: [{ to: G1, amount: "120.50", note: "October" }] });
	});

	it("reads a European export: semicolons, decimal commas, byte-order mark, CRLF", () => {
		const result = parseBatchCsv(`﻿Empfänger;Betrag;Zweck\r\n${G1};80,00;Trainer\r\n`, payees);
		expect(result).toEqual({ ok: true, value: [{ to: G1, amount: "80,00", note: "Trainer" }] });
	});

	it("reads rows without a header and without a reference", () => {
		const result = parseBatchCsv(`${G1}\t5\n${G1}\t6`, payees);
		expect(result.ok && result.value.map((line) => line.note)).toEqual(["", ""]);
	});

	it("turns a saved payee's name into their account, in any case", () => {
		const result = parseBatchCsv("ana costa,10,Kit", payees);
		expect(result.ok && result.value[0]?.to).toBe(G2);
	});

	it("keeps quoted separators and quotes inside a field", () => {
		const result = parseBatchCsv(`${G1},"1,250.00","Hotel ""Mar"", Lisbon"`, payees);
		expect(result).toEqual({
			ok: true,
			value: [{ to: G1, amount: "1,250.00", note: 'Hotel "Mar", Lisbon' }],
		});
	});

	it("names the row that is missing an amount or has a wrong one", () => {
		expect(parseBatchCsv(`recipient,amount\n${G1},5\n${G1},`, payees)).toEqual({
			ok: false,
			error: "Row 3 needs a recipient and an amount.",
		});
		expect(parseBatchCsv(`${G1},5\n${G1},0`, payees)).toEqual({
			ok: false,
			error: 'Row 2: "0" isn\'t an amount above zero.',
		});
	});

	it("refuses empty files and more lines than a batch holds", () => {
		expect(parseBatchCsv(" \n", payees).ok).toBe(false);
		expect(parseBatchCsv("recipient,amount\n", payees)).toEqual({
			ok: false,
			error: "The file has a header but no payments.",
		});
		const tooMany = Array.from({ length: MAX_BATCH_LINES + 1 }, () => `${G1},1`).join("\n");
		expect(parseBatchCsv(tooMany, payees).ok).toBe(false);
	});
});
