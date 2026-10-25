import { tokenBalance } from "../../../shared/tokenBalance.ts";
import type { OnchainSnapshot } from "./mapOrganization.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u32 } from "./scv.ts";

type Native = Record<string, unknown>;

const REQUEST_PAGE = 50;

const hex = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Everything the app shows about one organization, read from its contract in one round. */
export async function readOrganization(
	network: Network,
	contractId: string,
	token: string,
): Promise<OnchainSnapshot> {
	const [info, policy, members, requests, available, setupPhase, policyHash, balanceStroops] =
		await Promise.all([
			readContract(network, contractId, "info") as Promise<Native>,
			readContract(network, contractId, "policy") as Promise<Native>,
			readContract(network, contractId, "members") as Promise<Native[]>,
			readContract(network, contractId, "requests", [u32(0), u32(REQUEST_PAGE)]) as Promise<
				Native[]
			>,
			readContract(network, contractId, "available") as Promise<bigint>,
			readContract(network, contractId, "is_setup_phase") as Promise<boolean>,
			readContract(network, contractId, "policy_hash") as Promise<Uint8Array>,
			tokenBalance(network, token, contractId),
		]);
	return {
		contractId,
		info,
		policy,
		members,
		requests,
		availableStroops: BigInt(available),
		balanceStroops,
		setupPhase,
		policyHash: hex(policyHash),
	};
}

/** Organizations a person belongs to, from the registry. */
export async function readOrganizationsOf(
	network: Network,
	registry: string,
	person: string,
): Promise<string[]> {
	const orgs = (await readContract(network, registry, "orgs_of", [address(person)])) as unknown[];
	return orgs.map(String);
}

export type Profile = { name: string; avatarUrl: string | null };

/** Profiles from the registry; people who never set one come back as null. */
export async function readProfiles(
	network: Network,
	registry: string,
	people: readonly string[],
): Promise<Map<string, Profile | null>> {
	const profiles = await Promise.all(
		people.map(async (person) => {
			const native = (await readContract(network, registry, "profile", [address(person)])) as
				| { name: unknown; avatar: unknown }
				| null
				| undefined;
			if (!native) return [person, null] as const;
			const avatar = String(native.avatar ?? "");
			return [person, { name: String(native.name), avatarUrl: avatar || null }] as const;
		}),
	);
	return new Map(profiles);
}
