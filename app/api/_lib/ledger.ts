import {
	Account,
	Address,
	Contract,
	type Keypair,
	Operation,
	rpc,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk";
import { RequestError } from "./http.js";
import type { ServerConfig } from "./serverConfig.js";

// Simulation needs a syntactically valid source; it is never charged or required to exist.
const SIMULATION_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

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

/** Reads a token balance (in stroops) by simulating `balance(id)`. */
export async function tokenBalance(
	config: ServerConfig,
	token: string,
	holder: string,
): Promise<bigint> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: config.networkPassphrase,
	})
		.addOperation(new Contract(token).call("balance", new Address(holder).toScVal()))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(config.rpcUrl).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) return 0n;
	const value = simulation.result.retval;
	return value.switch().name === "scvI128"
		? (BigInt(value.i128().hi().toString()) << 64n) + BigInt(value.i128().lo().toString())
		: 0n;
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
	const prepared = await server.prepareTransaction(tx);
	prepared.sign(signer);
	const sent = await server.sendTransaction(prepared);
	if (sent.status === "ERROR") throw new RequestError("The network rejected the transaction.", 502);
	const final = await server.pollTransaction(sent.hash, { attempts: 20 });
	if (final.status !== "SUCCESS") {
		throw new RequestError("The transaction failed on the network.", 502);
	}
	return sent.hash;
}
