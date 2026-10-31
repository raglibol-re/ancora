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

/** How often a transaction is rebuilt and resent after a sequence clash or a "try again later". */
const SUBMIT_ATTEMPTS = 4;

/**
 * Signs and submits a contract call from a server-held key, waiting for the result. Every
 * server transaction comes from the one operator account (sponsored fees, organization
 * creation, test money, scheduled runs), so two at once can clash on the sequence number, and
 * the RPC sometimes asks to try again later: both are rebuilt with a fresh sequence and resent.
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
			.setTimeout(60)
			.build();
		const prepared = await server.prepareTransaction(tx).catch((error: unknown) => {
			const detail = error instanceof Error ? error.message : String(error);
			throw new RequestError(`The network refused the transaction: ${detail.slice(0, 300)}`, 502);
		});
		prepared.sign(signer);
		const sent = await server.sendTransaction(prepared);
		if (isRetryable(sent) && attempt < SUBMIT_ATTEMPTS) {
			// A short random pause so racing submissions don't clash again.
			await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700 * attempt));
			continue;
		}
		if (sent.status !== "PENDING" && sent.status !== "DUPLICATE") {
			throw new RequestError(
				`The network rejected the transaction (${sent.status}). Try again in a moment.`,
				502,
			);
		}
		const final = await server.pollTransaction(sent.hash, { attempts: 20 });
		if (final.status !== "SUCCESS") {
			throw new RequestError(
				`The transaction ended with status ${final.status} on the network.`,
				502,
			);
		}
		return sent.hash;
	}
}

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
