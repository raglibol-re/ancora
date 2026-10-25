import { Account, Address, Contract, rpc, TransactionBuilder } from "@stellar/stellar-sdk";

// Used by the browser (testnet adapter) and the Vercel Functions alike.

// Simulation needs a syntactically valid source; it is never charged or required to exist.
export const SIMULATION_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** Reads a token balance in stroops by simulating `balance(holder)`; 0 if unreadable. */
export async function tokenBalance(
	network: { rpcUrl: string; networkPassphrase: string },
	token: string,
	holder: string,
): Promise<bigint> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: network.networkPassphrase,
	})
		.addOperation(new Contract(token).call("balance", new Address(holder).toScVal()))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(network.rpcUrl).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) return 0n;
	const value = simulation.result.retval;
	if (value.switch().name !== "scvI128") return 0n;
	const parts = value.i128();
	return (BigInt(parts.hi().toString()) << 64n) + BigInt(parts.lo().toString());
}
