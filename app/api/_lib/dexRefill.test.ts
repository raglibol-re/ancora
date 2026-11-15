import { describe, expect, it, vi } from "vitest";
import { refillFromTestnetDex } from "./dexRefill.js";
import type { ServerConfig } from "./serverConfig.js";

const TESTNET = {
	rpcUrl: "https://soroban-testnet.stellar.org",
	networkPassphrase: "Test SDF Network ; September 2015",
} as ServerConfig;
const OPERATOR = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";
const BLEND_USDC = "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

describe("refillFromTestnetDex", () => {
	it("buys nothing for a token other than Circle's testnet USDC, before any network call", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		await expect(refillFromTestnetDex(TESTNET, BLEND_USDC, OPERATOR)).rejects.toThrow(
			"Only Circle's testnet USDC is bought on the exchange.",
		);
		expect(fetch).not.toHaveBeenCalled();
		fetch.mockRestore();
	});
});
