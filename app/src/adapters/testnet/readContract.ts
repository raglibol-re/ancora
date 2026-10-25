import {
	Account,
	Contract,
	rpc,
	scValToNative,
	TransactionBuilder,
	type xdr,
} from "@stellar/stellar-sdk";
import { SIMULATION_SOURCE } from "../../../shared/tokenBalance.ts";

export type Network = { rpcUrl: string; networkPassphrase: string };

/** Thrown when a read-only contract call fails to simulate (missing contract, bad args). */
export class ContractReadError extends Error {}

/** Calls a read-only contract function through simulation and returns the decoded value. */
export async function readContract(
	network: Network,
	contractId: string,
	fn: string,
	args: xdr.ScVal[] = [],
): Promise<unknown> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: network.networkPassphrase,
	})
		.addOperation(new Contract(contractId).call(fn, ...args))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(network.rpcUrl).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
		const detail = rpc.Api.isSimulationError(simulation) ? simulation.error : "no result";
		throw new ContractReadError(
			`${fn} on ${contractId.slice(0, 8)}… failed: ${detail.slice(0, 200)}`,
		);
	}
	return scValToNative(simulation.result.retval);
}
