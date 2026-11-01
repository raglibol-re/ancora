import { rpc, xdr } from "@stellar/stellar-sdk";
import type { Release } from "../../domain/dataSource.ts";
import { ContractReadError, type Network, readContract } from "./readContract.ts";
import { text } from "./scv.ts";

/** The organization's code on the Stellar Registry (`scripts/publish-registry.sh`). */
export const ORGANIZATION_RELEASE = "ancora-organization";

/** The newest published release, or null while nothing is published under the name. */
export async function latestRelease(network: Network, registry: string): Promise<Release | null> {
	const name = text(ORGANIZATION_RELEASE);
	try {
		const [version, hash] = await Promise.all([
			readContract(network, registry, "current_version", [name]),
			readContract(network, registry, "fetch_hash", [name, xdr.ScVal.scvVoid()]),
		]);
		return { version: String(version), wasmHash: Buffer.from(hash as Uint8Array).toString("hex") };
	} catch (error) {
		// The registry refuses a name nobody has published yet; anything else is a real failure.
		if (error instanceof ContractReadError) return null;
		throw error;
	}
}

/** The Wasm hash a contract runs, read from its instance entry on the ledger. */
export async function contractCodeHash(network: Network, contractId: string): Promise<string> {
	const entry = await new rpc.Server(network.rpcUrl).getContractData(
		contractId,
		xdr.ScVal.scvLedgerKeyContractInstance(),
		rpc.Durability.Persistent,
	);
	const executable = entry.val.contractData().val().instance().executable();
	return executable.wasmHash().toString("hex");
}
