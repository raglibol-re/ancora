import {
	Account,
	Contract,
	type Keypair,
	Operation,
	rpc,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk";
import { SIMULATION_SOURCE } from "../../shared/tokenBalance.js";
import { RequestError } from "./http.js";
import type { ServerConfig } from "./serverConfig.js";

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** True if the contract runs the smart-account WASM ancora accepts. */
export async function isSmartAccount(config: ServerConfig, contractId: string): Promise<boolean> {
	try {
		const response = await new rpc.Server(config.rpcUrl).getLedgerEntries(
			new Contract(contractId).getFootprint(),
		);
		const entry = response.entries[0];
		if (!entry) return false;
		const executable = entry.val.contractData().val().instance().executable();
		return (
			executable.switch().name === "contractExecutableWasm" &&
			toHex(executable.wasmHash()) === config.accountWasmHash
		);
	} catch {
		throw new RequestError("Could not check the account on the Stellar network. Try again.", 503);
	}
}

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

/** Signs and submits a contract call from a server-held key, waiting for the result. */
export async function invokeAsServer(
	config: ServerConfig,
	signer: Keypair,
	operation: xdr.Operation,
): Promise<string> {
	const server = new rpc.Server(config.rpcUrl);
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
	if (sent.status === "ERROR") throw new RequestError("The network rejected the transaction.", 502);
	const final = await server.pollTransaction(sent.hash, { attempts: 20 });
	if (final.status !== "SUCCESS") {
		throw new RequestError(
			`The transaction ended with status ${final.status} on the network.`,
			502,
		);
	}
	return sent.hash;
}
