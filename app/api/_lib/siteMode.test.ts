import { describe, expect, it } from "vitest";
import { siteMode } from "./siteMode.js";

describe("site mode", () => {
	it("is the testnet only when the deployment says so", () => {
		expect(siteMode("testnet")).toBe("testnet");
		expect(siteMode("sample")).toBe("sample");
		expect(siteMode(undefined)).toBe("sample");
		expect(siteMode("mainnet")).toBe("sample");
	});
});
