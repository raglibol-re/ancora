import type { xdr } from "@stellar/stellar-sdk";
import { type Network, readContract } from "./readContract.ts";
import { address, text } from "./scv.ts";

// The Stellar Registry (stellar-registry/contracts): `register_contract(name, address, owner)`
// names an existing contract, `fetch_contract_id(name)` resolves a name and fails when it is
// free. ancora registers organizations in the registry's open ("unverified") channel, whose
// contract id comes from config; the verified root channel needs the registry's manager.

/** Where `name` points, or null when it is free. */
export async function resolveRegistryName(
	network: Network,
	registry: string,
	name: string,
): Promise<string | null> {
	try {
		return String(await readContract(network, registry, "fetch_contract_id", [text(name)]));
	} catch {
		// The registry errors on unknown names: that is the "free" answer.
		return null;
	}
}

/** Arguments of `register_contract(contract_name, contract_address, owner)`. */
export const registerContractArgs = (
	name: string,
	contract: string,
	owner: string,
): xdr.ScVal[] => [text(name), address(contract), address(owner)];
