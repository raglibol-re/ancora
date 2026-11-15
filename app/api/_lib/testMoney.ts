import { Keypair } from "@stellar/stellar-sdk";
import { tokenBalance } from "../../shared/tokenBalance.js";
import { required, type ServerConfig } from "./serverConfig.js";

// Test money comes from the demo operator's float of each accepted stablecoin. BlendUSDC and
// Circle USDC refill themselves (test-money.ts); EURC is hand-filled from a faucet that isn't
// always handing anything out, so the app is told per asset whether a grant is possible.

export const STROOPS_PER_UNIT = 10_000_000n;
const FULL_GRANT = 100n * STROOPS_PER_UNIT;
/** Below this float grants shrink (grantFor), so the float refills itself where it can. */
export const REFILL_BELOW = 5n * FULL_GRANT;

/**
 * 100 units while the float is comfortable; a tenth of what is left when it runs low, so a
 * hand-filled float serves many demos instead of one.
 */
export function grantFor(float: bigint): bigint {
	if (float >= REFILL_BELOW) return FULL_GRANT;
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
