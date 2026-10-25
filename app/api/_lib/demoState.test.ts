import { describe, expect, it } from "vitest";
import { parseDemoState } from "./demoState.js";

describe("parseDemoState", () => {
	it("falls back to sample data for anything unexpected", () => {
		expect(parseDemoState(null)).toEqual({ mode: "sample", updatedAt: null });
		expect(parseDemoState({ mode: "mainnet" })).toEqual({ mode: "sample", updatedAt: null });
		expect(parseDemoState("testnet")).toEqual({ mode: "sample", updatedAt: null });
	});

	it("keeps a valid state", () => {
		expect(parseDemoState({ mode: "testnet", updatedAt: "2026-10-25T16:00:00.000Z" })).toEqual({
			mode: "testnet",
			updatedAt: "2026-10-25T16:00:00.000Z",
		});
	});
});
