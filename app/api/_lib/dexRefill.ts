import { Asset, BASE_FEE, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { rpcServer } from "../../shared/rpcServer.js";
import type { ServerConfig } from "./serverConfig.js";
import { fundedThrowaway, submit } from "./throwawayAccount.js";

// Circle's testnet faucet is captcha-gated, but the testnet has a large XLM/USDC liquidity pool
// (about 139 XLM for 100 USDC on 15 Nov 2026). A throwaway account funded by Friendbot sells its
// XLM there and the USDC goes straight to the operator's float. Testnet only; prices on testnet
// carry no value, so the minimum received only guards against an empty pool.

/** Circle's testnet USDC, the classic asset behind the token the organizations accept. */
const CIRCLE_TESTNET_USDC = new Asset(
	"USDC",
	"GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);
/** Friendbot gives 10,000 XLM; the rest pays the account's reserve and fees. */
const XLM_TO_SELL = "9900";
/** Less than this means the pool is nearly empty: better no refill than a worthless one. */
const MIN_RECEIVED = "1000";

/** Buys Circle testnet USDC with Friendbot's XLM for `operator`. Returns the XLM sold. */
export async function refillFromTestnetDex(
	config: ServerConfig,
	token: string,
	operator: string,
): Promise<string> {
	if (CIRCLE_TESTNET_USDC.contractId(config.networkPassphrase) !== token) {
		throw new Error("Only Circle's testnet USDC is bought on the exchange.");
	}
	const server = rpcServer(config.rpcUrl);
	const helper = await fundedThrowaway();
	const buy = new TransactionBuilder(await server.getAccount(helper.publicKey()), {
		fee: BASE_FEE,
		networkPassphrase: config.networkPassphrase,
	})
		.addOperation(
			Operation.pathPaymentStrictSend({
				sendAsset: Asset.native(),
				sendAmount: XLM_TO_SELL,
				destination: operator,
				destAsset: CIRCLE_TESTNET_USDC,
				destMin: MIN_RECEIVED,
				path: [],
			}),
		)
		.setTimeout(60)
		.build();
	buy.sign(helper);
	await submit(server, buy);
	return XLM_TO_SELL;
}
