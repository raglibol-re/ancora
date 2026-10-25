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
};

export function readTestnetConfig(env: EnvSource): TestnetConfig | null {
	const entries = Object.entries(KEYS).map(([field, key]) => [field, env[key]] as const);
	if (entries.some(([, value]) => typeof value !== "string" || value === "")) return null;
	return Object.fromEntries(entries) as TestnetConfig;
}

export const testnetConfig = readTestnetConfig(import.meta.env);

/** The deployments this build is wired to, labeled for people. */
export function listDeployments(config: TestnetConfig): { label: string; id: string }[] {
	return [
		{ label: "ancora registry (profiles, memberships)", id: config.registryContract },
		{ label: "USDC (BlendUSDC)", id: config.usdcToken },
		{ label: "Reserve vault (DeFindex)", id: config.defindexVault },
		{ label: "Passkey verifier", id: config.webauthnVerifier },
		{ label: "Ed25519 verifier", id: config.ed25519Verifier },
		{ label: "Threshold policy", id: config.thresholdPolicy },
		{ label: "Spending-limit policy", id: config.spendingLimitPolicy },
		{ label: "Native XLM token", id: config.nativeToken },
	];
}
