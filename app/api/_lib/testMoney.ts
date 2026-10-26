import { Keypair } from "@stellar/stellar-sdk";
import { tokenBalance } from "../../shared/tokenBalance.js";
import { required, type ServerConfig } from "./serverConfig.js";

// Test money comes from the demo operator's float of each accepted stablecoin. The float is
// hand-filled from the issuers' testnet faucets, which are not always handing anything out
// (Circle's was down on 26 Oct 2026), so the app is told per asset whether a grant is possible.

export const STROOPS_PER_UNIT = 10_000_000n;
const FULL_GRANT = 100n * STROOPS_PER_UNIT;

/**
 * 100 units while the float is comfortable; a tenth of what is left when it runs low, so a
 * hand-filled float serves many demos instead of one.
 */
export function grantFor(float: bigint): bigint {
	if (float >= 5n * FULL_GRANT) return FULL_GRANT;
	return float / 10n;
}

/** Whether the operator could send at least a unit of each accepted asset right now. */
export async function testMoneyAvailability(
	config: ServerConfig,
): Promise<{ token: string; symbol: string; available: boolean }[]> {
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET")).publicKey();
	const assets = [...config.orgAssets.values()];
	const floats = await Promise.all(
		assets.map((asset) => tokenBalance(config, asset.token, operator).catch(() => 0n)),
	);
	return assets.map((asset, index) => ({
		token: asset.token,
		symbol: asset.symbol,
		available: grantFor(floats[index] ?? 0n) >= STROOPS_PER_UNIT,
	}));
}
