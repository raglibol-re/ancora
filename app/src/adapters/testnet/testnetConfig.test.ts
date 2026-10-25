import { describe, expect, it } from "vitest";
import { readTestnetConfig } from "./testnetConfig.ts";

const complete = {
	VITE_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
	VITE_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
	VITE_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
	VITE_DEPLOYER_ADDRESS: "GDEPLOYER",
	VITE_USDC_TOKEN: "CUSDC",
	VITE_NATIVE_TOKEN: "CXLM",
	VITE_DEFINDEX_VAULT: "CVAULT",
	VITE_ACCOUNT_WASM_HASH: "abc",
	VITE_WEBAUTHN_VERIFIER: "CWEBAUTHN",
	VITE_ED25519_VERIFIER: "CED",
	VITE_THRESHOLD_POLICY: "CTHRESHOLD",
	VITE_SPENDING_LIMIT_POLICY: "CLIMIT",
	VITE_RELAYER_URL: "https://relayer.example",
	VITE_REGISTRY_CONTRACT: "CREGISTRY",
	VITE_ORG_WASM_HASH: "def",
	VITE_ORG_ASSETS: "BlendUSDC:CUSDC:USD,USDC:CCIRCLE:USD",
};

describe("readTestnetConfig", () => {
	it("maps a complete env file", () => {
		expect(readTestnetConfig(complete)).toMatchObject({
			usdcToken: "CUSDC",
			defindexVault: "CVAULT",
		});
	});

	it("returns null when any value is missing, so the app stays on sample data", () => {
		expect(readTestnetConfig({ ...complete, VITE_DEFINDEX_VAULT: "" })).toBeNull();
		expect(readTestnetConfig({})).toBeNull();
	});
});
