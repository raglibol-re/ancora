/**
 * Server-side configuration from Vercel environment variables, kept in sync with the testnet by
 * `scripts/setup-testnet.sh --sync-vercel`. The one secret (DEPLOYER_SECRET) exists only
 * here, never in the client bundle.
 */
export type ServerConfig = {
	rpcUrl: string;
	networkPassphrase: string;
	accountWasmHash: string;
	usdcToken: string;
	allowedOrigins: Set<string>;
	/** Set by scripts/setup-testnet.sh once ancora's own contracts are deployed; empty before. */
	orgWasmHash: string;
	registryContract: string;
};

export class ConfigError extends Error {}

export function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new ConfigError(`Server is missing the ${name} setting.`);
	return value;
}

export function serverConfig(): ServerConfig {
	return {
		rpcUrl: required("STELLAR_RPC_URL"),
		networkPassphrase: required("STELLAR_NETWORK_PASSPHRASE"),
		accountWasmHash: required("ACCOUNT_WASM_HASH").toLowerCase(),
		usdcToken: required("USDC_TOKEN"),
		orgWasmHash: (process.env.ORG_WASM_HASH ?? "").toLowerCase(),
		registryContract: process.env.REGISTRY_CONTRACT ?? "",
		allowedOrigins: new Set(
			required("ALLOWED_ORIGINS")
				.split(",")
				.map((origin) => origin.trim())
				.filter(Boolean),
		),
	};
}
