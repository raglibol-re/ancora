import {
	Account,
	Address,
	Contract,
	hash,
	rpc,
	StrKey,
	scValToNative,
	TransactionBuilder,
	xdr,
} from "@stellar/stellar-sdk";
import { SIMULATION_SOURCE } from "../../shared/tokenBalance.js";
import { RequestError } from "./http.js";
import type { ServerConfig } from "./serverConfig.js";

/** Calls a read-only contract function through simulation and decodes the result. */
export async function readView(
	config: ServerConfig,
	contractId: string,
	fn: string,
	args: xdr.ScVal[] = [],
): Promise<unknown> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: config.networkPassphrase,
	})
		.addOperation(new Contract(contractId).call(fn, ...args))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(config.rpcUrl).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
		throw new RequestError("The organization couldn't be read right now. Try again shortly.", 502);
	}
	return scValToNative(simulation.result.retval);
}

/** The WASM hash a deployed contract runs, lowercase hex; null when it doesn't exist. */
export async function contractWasmHash(
	config: ServerConfig,
	contractId: string,
): Promise<string | null> {
	try {
		const response = await new rpc.Server(config.rpcUrl).getLedgerEntries(
			new Contract(contractId).getFootprint(),
		);
		const entry = response.entries[0];
		if (!entry) return null;
		const executable = entry.val.contractData().val().instance().executable();
		if (executable.switch().name !== "contractExecutableWasm") return null;
		return Buffer.from(executable.wasmHash()).toString("hex");
	} catch {
		throw new RequestError("Could not check the contract on the Stellar network. Try again.", 503);
	}
}

/** True if the contract runs the smart-account WASM ancora accepts (a person's identity). */
export async function isSmartAccount(config: ServerConfig, contractId: string): Promise<boolean> {
	return (await contractWasmHash(config, contractId)) === config.accountWasmHash;
}

/** True if the contract is an ancora organization. */
export async function isOrganization(config: ServerConfig, contractId: string): Promise<boolean> {
	return (await contractWasmHash(config, contractId)) === config.orgWasmHash;
}

/**
 * Contract id of a `createContractV2` deployment by `deployer` with `salt`: the same derivation
 * the network uses, so the id is known before the transaction is sent.
 */
export function deployedContractId(
	networkPassphrase: string,
	deployer: string,
	salt: Buffer,
): string {
	const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
		new xdr.HashIdPreimageContractId({
			networkId: hash(Buffer.from(networkPassphrase)),
			contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
				new xdr.ContractIdPreimageFromAddress({
					address: new Address(deployer).toScAddress(),
					salt,
				}),
			),
		}),
	);
	return StrKey.encodeContract(hash(preimage.toXDR()));
}
