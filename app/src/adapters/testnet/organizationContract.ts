import { tokenBalance } from "../../../shared/tokenBalance.ts";
import { mapBudgetUse, mapLimit, type OnchainSnapshot } from "./mapOrganization.ts";
import { ContractReadError, type Network, readContract } from "./readContract.ts";
import { address, u32 } from "./scv.ts";

type Native = Record<string, unknown>;

const REQUEST_PAGE = 50;

const hex = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * Organizations deployed before the spending-limit upgrade (26 Oct 2026) have no `spending_limits`
 * view; they simply have no limits. Only a failed simulation is treated that way, network errors
 * still surface.
 */
async function readSpendingLimits(network: Network, contractId: string): Promise<Native[]> {
	try {
		return (await readContract(network, contractId, "spending_limits")) as Native[];
	} catch (error) {
		if (error instanceof ContractReadError) return [];
		throw error;
	}
}

/** Same tolerance for `budgets`, which organizations before 26 Oct 2026 don't have. */
async function readBudgets(network: Network, contractId: string): Promise<Native[]> {
	try {
		return (await readContract(network, contractId, "budgets")) as Native[];
	} catch (error) {
		if (error instanceof ContractReadError) return [];
		throw error;
	}
}

/** Everything the app shows about one organization, read from its contract in two rounds. */
export async function readOrganization(
	network: Network,
	contractId: string,
): Promise<OnchainSnapshot> {
	const [info, policy, assets, members, requests, setupPhase, policyHash, limitRows, budgetRows] =
		await Promise.all([
			readContract(network, contractId, "info") as Promise<Native>,
			readContract(network, contractId, "policy") as Promise<Native>,
			readContract(network, contractId, "assets") as Promise<Native[]>,
			readContract(network, contractId, "members") as Promise<Native[]>,
			readContract(network, contractId, "requests", [u32(0), u32(REQUEST_PAGE)]) as Promise<
				Native[]
			>,
			readContract(network, contractId, "is_setup_phase") as Promise<boolean>,
			readContract(network, contractId, "policy_hash") as Promise<Uint8Array>,
			readSpendingLimits(network, contractId),
			readBudgets(network, contractId),
		]);
	const limits = new Map(
		limitRows.map((row) => [String(row.member), mapLimit(row.limit as Native)] as const),
	);
	// One balance per accepted token, from the token contracts themselves.
	const balances = new Map(
		await Promise.all(
			assets.map(async (asset) => {
				const token = String(asset.token);
				return [token, await tokenBalance(network, token, contractId)] as const;
			}),
		),
	);
	// The Reserve of each asset that has a vault: value today and the principal moved in.
	const reserves = new Map(
		await Promise.all(
			assets
				.filter((asset) => asset.vault)
				.map(async (asset) => {
					const token = String(asset.token);
					const view = (await readContract(network, contractId, "reserve", [address(token)])) as {
						value: unknown;
						principal: unknown;
					};
					return [
						token,
						{ value: BigInt(view.value as bigint), principal: BigInt(view.principal as bigint) },
					] as const;
				}),
		),
	);
	return {
		contractId,
		info,
		policy,
		assets,
		members,
		requests,
		balances,
		reserves,
		limits,
		budgetUse: mapBudgetUse(budgetRows),
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
