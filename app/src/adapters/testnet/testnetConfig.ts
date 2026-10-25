import type { Asset } from "../../domain/rules/model.ts";

/**
 * Public testnet deployment IDs, written to app/.env.testnet by scripts/setup-testnet.sh and
 * bundled at build time (`vite --mode testnet`). Null when the file is missing or incomplete,
 * e.g. in unit tests; callers then stay on sample data.
 */
export type TestnetConfig = {
	rpcUrl: string;
	/** Horizon is only used to describe a recipient's trustlines; everything else goes through RPC. */
	horizonUrl: string;
	networkPassphrase: string;
	deployerAddress: string;
	usdcToken: string;
	nativeToken: string;
	defindexVault: string;
	accountWasmHash: string;
	webauthnVerifier: string;
	ed25519Verifier: string;
	thresholdPolicy: string;
	spendingLimitPolicy: string;
	relayerUrl: string;
	registryContract: string;
	orgWasmHash: string;
	/** "Symbol:C…:USD,…": the stablecoins an organization may accept (see parseAssetOptions). */
	orgAssets: string;
};

type EnvSource = Record<string, string | boolean | undefined>;

const KEYS: Record<keyof TestnetConfig, string> = {
	rpcUrl: "VITE_STELLAR_RPC_URL",
	horizonUrl: "VITE_STELLAR_HORIZON_URL",
	networkPassphrase: "VITE_STELLAR_NETWORK_PASSPHRASE",
	deployerAddress: "VITE_DEPLOYER_ADDRESS",
	usdcToken: "VITE_USDC_TOKEN",
	nativeToken: "VITE_NATIVE_TOKEN",
	defindexVault: "VITE_DEFINDEX_VAULT",
	accountWasmHash: "VITE_ACCOUNT_WASM_HASH",
	webauthnVerifier: "VITE_WEBAUTHN_VERIFIER",
	ed25519Verifier: "VITE_ED25519_VERIFIER",
	thresholdPolicy: "VITE_THRESHOLD_POLICY",
	spendingLimitPolicy: "VITE_SPENDING_LIMIT_POLICY",
	relayerUrl: "VITE_RELAYER_URL",
	registryContract: "VITE_REGISTRY_CONTRACT",
	orgWasmHash: "VITE_ORG_WASM_HASH",
	orgAssets: "VITE_ORG_ASSETS",
};

export type AssetOption = Asset & { label: string };

/** Parses "BlendUSDC:CAQCF…:USD,USDC:CBIEL…:USD" into the assets an organization may accept. */
export function parseAssetOptions(spec: string): AssetOption[] {
	return spec
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.flatMap((entry) => {
			const [symbol, token, currency] = entry.split(":");
			if (!symbol || !token || (currency !== "EUR" && currency !== "USD")) return [];
			return [{ symbol, token, currency, label: `${symbol} (${currency})` }];
		});
}

export function readTestnetConfig(env: EnvSource): TestnetConfig | null {
	// Every key must be present; the asset list must parse to at least one asset.
	const entries = Object.entries(KEYS).map(([field, key]) => [field, env[key]] as const);
	if (entries.some(([, value]) => typeof value !== "string" || value === "")) return null;
	const config = Object.fromEntries(entries) as TestnetConfig;
	return parseAssetOptions(config.orgAssets).length > 0 ? config : null;
}

export const testnetConfig = readTestnetConfig(import.meta.env);

/** The deployments this build is wired to, labeled for people. */
export function listDeployments(config: TestnetConfig): { label: string; id: string }[] {
	return [
		{ label: "ancora registry (profiles, memberships)", id: config.registryContract },
		...parseAssetOptions(config.orgAssets).map((asset) => ({
			label: `${asset.symbol} token (${asset.currency})`,
			id: asset.token,
		})),
		{ label: "Reserve vault (DeFindex)", id: config.defindexVault },
		{ label: "Passkey verifier", id: config.webauthnVerifier },
		{ label: "Ed25519 verifier", id: config.ed25519Verifier },
		{ label: "Threshold policy", id: config.thresholdPolicy },
		{ label: "Spending-limit policy", id: config.spendingLimitPolicy },
		{ label: "Native XLM token", id: config.nativeToken },
	];
}
