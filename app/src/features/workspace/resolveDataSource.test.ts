import { describe, expect, it } from "vitest";
import { resolveDataSource } from "./resolveDataSource.ts";

const up = { mode: "testnet" as const, rpcOk: true };
const rpcDown = { mode: "testnet" as const, rpcOk: false };
const siteSample = { mode: "sample" as const, rpcOk: true };

describe("resolveDataSource", () => {
	it("serves sample data immediately, without waiting for the site health", () => {
		expect(resolveDataSource("sample", null, true)).toMatchObject({
			effective: "sample",
			fallbackReason: null,
		});
	});

	it("waits for the site health when the answer depends on it", () => {
		expect(resolveDataSource("auto", null, true)).toBeNull();
		expect(resolveDataSource("testnet", null, true)).toBeNull();
	});

	it("follows the site default", () => {
		expect(resolveDataSource("auto", siteSample, true)).toMatchObject({ effective: "sample" });
		expect(resolveDataSource("auto", up, true)).toMatchObject({
			effective: "testnet",
			fallbackReason: null,
			demoMode: "testnet",
		});
	});

	it("falls back to sample data with a reason when the testnet can't be used", () => {
		expect(resolveDataSource("testnet", rpcDown, true)).toMatchObject({
			effective: "sample",
			fallbackReason: "The Stellar testnet is unreachable right now.",
		});
		expect(resolveDataSource("testnet", "unreachable", true)?.fallbackReason).toMatch(/server/);
		expect(resolveDataSource("testnet", up, false)?.fallbackReason).toMatch(/configuration/);
	});

	it("treats an unreachable server as the sample default without calling it a fallback", () => {
		expect(resolveDataSource("auto", "unreachable", true)).toEqual({
			effective: "sample",
			fallbackReason: null,
			demoMode: null,
		});
	});
});
