import {
	Asset,
	BASE_FEE,
	Keypair,
	Operation,
	type Transaction,
	TransactionBuilder,
} from "@stellar/stellar-sdk";
import { rpcServer } from "../../shared/rpcServer.js";
import type { ServerConfig } from "./serverConfig.js";

// The test float of BlendUSDC refills itself from Blend's testnet faucet, the same mechanism as
// `refill_usdc_float` in scripts/setup-testnet.sh (see docs/DECISIONS.md, 2026-10-25): the faucet
// pays each account once, so a throwaway key funded by Friendbot claims it and forwards the USDC
// to the operator. Testnet only; nothing here can touch an organization's money.

const FRIENDBOT = "https://friendbot.stellar.org";
const BLEND_FAUCET = "https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets";
const POLL_ATTEMPTS = 20;

/**
 * Claims Blend's faucet with a fresh key and sends the USDC to `operator`. Returns the amount
 * forwarded (for example "1000.0000000"). Refuses when the faucet's USDC isn't `token`, so a
 * changed faucet can't fill the float with some other asset.
 */
export async function refillFromBlendFaucet(
	config: ServerConfig,
	token: string,
	operator: string,
): Promise<string> {
	const server = rpcServer(config.rpcUrl);
	const helper = Keypair.random();
	const funded = await fetch(`${FRIENDBOT}?addr=${helper.publicKey()}`);
	if (!funded.ok) throw new Error(`Friendbot answered ${funded.status}.`);

	const answer = await fetch(`${BLEND_FAUCET}?userId=${helper.publicKey()}`);
	if (!answer.ok) throw new Error(`Blend's faucet answered ${answer.status}.`);
	const claim = TransactionBuilder.fromXDR(
		(await answer.text()).replaceAll('"', ""),
		config.networkPassphrase,
	) as Transaction;
	const usdc = claim.operations.find(
		(op) =>
			op.type === "payment" &&
			op.destination === helper.publicKey() &&
			op.asset.contractId(config.networkPassphrase) === token,
	);
	if (usdc?.type !== "payment") throw new Error("Blend's faucet no longer pays this token.");
	claim.sign(helper);
	await submit(server, claim);

	const forward = new TransactionBuilder(await server.getAccount(helper.publicKey()), {
		fee: BASE_FEE,
		networkPassphrase: config.networkPassphrase,
	})
		.addOperation(
			Operation.payment({
				destination: operator,
				asset: new Asset(usdc.asset.getCode(), usdc.asset.getIssuer()),
				amount: usdc.amount,
			}),
		)
		.setTimeout(60)
		.build();
	forward.sign(helper);
	await submit(server, forward);
	return usdc.amount;
}

async function submit(server: ReturnType<typeof rpcServer>, tx: Transaction): Promise<void> {
	const sent = await server.sendTransaction(tx);
	if (sent.status !== "PENDING" && sent.status !== "DUPLICATE") {
		throw new Error(`The network rejected the transaction (${sent.status}).`);
	}
	const outcome = await server.pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS });
	if (outcome.status !== "SUCCESS") throw new Error(`The transaction ended ${outcome.status}.`);
}
