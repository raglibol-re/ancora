import type { FundingSupport, RampSupport } from "../../domain/dataSource.ts";
import type { TestnetConfig } from "./testnetConfig.ts";

// Money in from a Stellar wallet and through the anchor. Stellar Wallets Kit, the wallet SDKs
// and the anchor client are large, so they load only when someone uses them.

/** Funding an organization from a wallet the person connects. */
export function createFundingSupport(
	config: TestnetConfig,
	refresh: () => Promise<void>,
): FundingSupport {
	const funding = () => import("./walletFunding.ts");
	return {
		connectWallet: (container) => funding().then((f) => f.connectWallet(container)),
		disconnectWallet: () => funding().then((f) => f.disconnectWallet()),
		walletBalance: (token, holder) => funding().then((f) => f.walletBalance(config, token, holder)),
		assetName: (token) => funding().then((f) => f.assetName(config, token)),
		depositFromWallet: async (orgId, token, from, amount) => {
			const result = await (await funding()).depositFromWallet(config, token, from, orgId, amount);
			if (result.ok) await refresh();
			return result;
		},
	};
}

/** Bank in and out through the anchor; it needs the wallet kit to sign in, too. */
export function createRampSupport(config: TestnetConfig): RampSupport {
	const ramp = () => import("./anchorRamp.ts");
	return {
		info: () => ramp().then((r) => r.anchorInfo(config)),
		startDeposit: (token, wallet) => ramp().then((r) => r.startDeposit(config, token, wallet)),
		startWithdrawal: (token, wallet) =>
			ramp().then((r) => r.startWithdrawal(config, token, wallet)),
		transaction: (wallet, id) => ramp().then((r) => r.anchorTransaction(config, wallet, id)),
	};
}
