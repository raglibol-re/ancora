import {
	Account,
	type Keypair,
	Operation,
	rpc,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk";
import { SIMULATION_SOURCE } from "../../shared/tokenBalance.js";
import { RequestError } from "./http.js";
import type { ServerConfig } from "./serverConfig.js";

/** Simulates a host function with its auth entries; returns the minimum resource fee. */
export async function simulatedResourceFee(
	config: ServerConfig,
	func: xdr.HostFunction,
	auth: xdr.SorobanAuthorizationEntry[],
): Promise<bigint> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: config.networkPassphrase,
	})
		.addOperation(Operation.invokeHostFunction({ func, auth }))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(config.rpcUrl).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || rpc.Api.isSimulationRestore(simulation)) {
		throw new RequestError("The transaction would fail on the network, so it was not sent.");
	}
	return BigInt(simulation.minResourceFee);
}

/** How often a transaction is rebuilt and resent after it couldn't land. */
const SUBMIT_ATTEMPTS = 3;
/** A server transaction is valid this long; after that it can never apply, so resending is safe. */
const VALID_SECONDS = 20;
const POLL_MS = 1_500;

/**
 * Signs and submits a contract call from a server-held key, waiting for the result. Every
 * server transaction comes from the one operator account (sponsored fees, organization
 * creation, test money, scheduled runs), so two at once can clash on the sequence number: the
 * RPC refuses one, asks to try again later, or accepts both and the network drops one. Each
 * case is rebuilt with a fresh sequence and resent. A dropped transaction is only resent once
 * its short validity window has passed, so the same action can never apply twice.
 */
export async function invokeAsServer(
	config: ServerConfig,
	signer: Keypair,
	operation: xdr.Operation,
): Promise<string> {
	const server = new rpc.Server(config.rpcUrl);
	for (let attempt = 1; ; attempt++) {
		const source = await server.getAccount(signer.publicKey());
		const tx = new TransactionBuilder(source, {
			fee: "1000000",
			networkPassphrase: config.networkPassphrase,
		})
			.addOperation(operation)
			.setTimeout(VALID_SECONDS)
			.build();
		const prepared = await server.prepareTransaction(tx).catch((error: unknown) => {
			const detail = error instanceof Error ? error.message : String(error);
			throw new RequestError(`The network refused the transaction: ${detail.slice(0, 300)}`, 502);
		});
		prepared.sign(signer);
		const validUntil = Number(prepared.timeBounds?.maxTime ?? 0) * 1000;
		const sent = await server.sendTransaction(prepared);
		const last = attempt >= SUBMIT_ATTEMPTS;
		if (isRetryable(sent) && !last) {
			// A short random pause so racing submissions don't clash again.
			await sleep(300 + Math.random() * 700 * attempt);
			continue;
		}
		if (sent.status !== "PENDING" && sent.status !== "DUPLICATE") {
			throw new RequestError(
				`The network rejected the transaction (${sent.status}). Try again in a moment.`,
				502,
			);
		}
		const outcome = await awaitOutcome(server, sent.hash, validUntil);
		if (outcome === "SUCCESS") return sent.hash;
		if (outcome === "FAILED") {
			throw new RequestError("The transaction failed on the network.", 502);
		}
		// Dropped, and past its validity window: it can no longer apply, so resend it.
		if (last) {
			throw new RequestError(
				"The network didn't take the transaction. Try again in a moment.",
				502,
			);
		}
	}
}

/** SUCCESS or FAILED as soon as known; DROPPED once the transaction's validity has expired. */
async function awaitOutcome(
	server: rpc.Server,
	hash: string,
	validUntil: number,
): Promise<"SUCCESS" | "FAILED" | "DROPPED"> {
	// A few seconds past the window covers the ledger that might still include it.
	while (Date.now() < validUntil + 6_000) {
		const status = await server.getTransaction(hash);
		if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
		if (status.status === rpc.Api.GetTransactionStatus.FAILED) return "FAILED";
		await sleep(POLL_MS);
	}
	const final = await server.getTransaction(hash);
	if (final.status === rpc.Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
	if (final.status === rpc.Api.GetTransactionStatus.FAILED) return "FAILED";
	return "DROPPED";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A sequence clash with another server transaction, or the RPC asking to try again later. */
function isRetryable(sent: rpc.Api.SendTransactionResponse): boolean {
	if (sent.status === "TRY_AGAIN_LATER") return true;
	if (sent.status !== "ERROR") return false;
	try {
		return sent.errorResult?.result().switch().name === "txBadSeq";
	} catch {
		return false;
	}
}
