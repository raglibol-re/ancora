import { describe, expect, it } from "vitest";
import { parseAmountInput } from "./money.ts";

describe("parseAmountInput", () => {
	it.each([
		["80", 8_000],
		["80.5", 8_050],
		["80,50", 8_050],
		["1,250.75", 125_075],
		["€ 1250", 125_000],
		["0.01", 1],
	])("parses %s", (input, cents) => {
		expect(parseAmountInput(input)).toBe(cents);
	});

	it.each(["", "0", "0.00", "-5", "1.234", "abc", "1,25,0", "12.5.3"])("rejects %j", (input) => {
		expect(parseAmountInput(input)).toBeNull();
	});
});
