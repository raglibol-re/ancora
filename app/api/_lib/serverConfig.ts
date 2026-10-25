/**
 * Server-side configuration from Vercel environment variables, kept in sync with the testnet by
 * `scripts/setup-testnet.sh --sync-vercel`. Secrets (DEPLOYER_SECRET, RELAYER_API_KEY) exist only
 * here, never in the client bundle.
 */
export type ServerConfig = {
	rpcUrl: string;
	networkPassphrase: string;
	accountWasmHash: string;
	usdcToken: string;
	allowedOrigins: Set<string>;
	relayerBaseUrl: string;
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
		allowedOrigins: new Set(
			required("ALLOWED_ORIGINS")
				.split(",")
				.map((origin) => origin.trim())
				.filter(Boolean),
		),
		relayerBaseUrl: process.env.RELAYER_BASE_URL ?? "https://channels.openzeppelin.com/testnet",
	};
}
