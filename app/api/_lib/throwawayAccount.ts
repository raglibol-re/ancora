import { Keypair, type Transaction } from "@stellar/stellar-sdk";
import type { rpcServer } from "../../shared/rpcServer.js";

// A fresh testnet account funded by Friendbot (10,000 XLM), for the jobs that refill the test
// floats without touching the operator's own XLM. Testnet only.

const FRIENDBOT = "https://friendbot.stellar.org";
const POLL_ATTEMPTS = 20;

/** A new key whose account Friendbot has funded. */
export async function fundedThrowaway(): Promise<Keypair> {
	const helper = Keypair.random();
	const funded = await fetch(`${FRIENDBOT}?addr=${helper.publicKey()}`);
	if (!funded.ok) throw new Error(`Friendbot answered ${funded.status}.`);
	return helper;
}

/** Sends a signed transaction and waits until it succeeded; throws otherwise. */
export async function submit(server: ReturnType<typeof rpcServer>, tx: Transaction): Promise<void> {
	const sent = await server.sendTransaction(tx);
	if (sent.status !== "PENDING" && sent.status !== "DUPLICATE") {
		throw new Error(`The network rejected the transaction (${sent.status}).`);
	}
	const outcome = await server.pollTransaction(sent.hash, { attempts: POLL_ATTEMPTS });
	if (outcome.status !== "SUCCESS") throw new Error(`The transaction ended ${outcome.status}.`);
}
