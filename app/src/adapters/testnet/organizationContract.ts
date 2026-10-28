import { tokenBalance } from "../../../shared/tokenBalance.ts";
import type { HistoryCache } from "./historyCache.ts";
import { mapBudgetUse, mapLimit, type OnchainSnapshot } from "./mapOrganization.ts";
import { type HistoryPage, readTransfers } from "./orgHistory.ts";
import { ContractReadError, type Network, readContract } from "./readContract.ts";
import { address, u32, u64 } from "./scv.ts";

type Native = Record<string, unknown>;

const REQUEST_PAGE = 50;

/** A unit enum variant arrives as `["Name"]` or `"Name"` depending on the decoder path. */
const statusName = (value: unknown): string =>
	Array.isArray(value) ? String(value[0]) : String(value);

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

/** `standing_orders` arrived on 26 Oct 2026; older organizations answer null (no support). */
async function readStandingOrders(network: Network, contractId: string): Promise<Native[] | null> {
	try {
		return (await readContract(network, contractId, "standing_orders")) as Native[];
	} catch (error) {
		if (error instanceof ContractReadError) return null;
		throw error;
	}
}

/** Payment links with who paid them (interface version 6); null for older organizations. */
async function readLinks(network: Network, contractId: string): Promise<Native[] | null> {
	let rows: Native[];
	try {
		rows = (await readContract(network, contractId, "links")) as Native[];
	} catch (error) {
		if (error instanceof ContractReadError) return null;
		throw error;
	}
	// Payers of the newest links only: older ones are settled and cost a read each.
	return Promise.all(
		rows.map(async (row, index) =>
			index < 20
				? {
						...row,
						payments: (await readContract(network, contractId, "link_payments", [
							u64(Number(row.id)),
						])) as Native[],
					}
				: { ...row, payments: [] },
		),
	);
}

/** The address book (interface version 4); null for organizations whose code has none. */
async function readPayees(network: Network, contractId: string): Promise<Native[] | null> {
	try {
		return (await readContract(network, contractId, "payees")) as Native[];
	} catch (error) {
		if (error instanceof ContractReadError) return null;
		throw error;
	}
}

/** The interface version (`version()`, from 28 Oct 2026); 0 for older organizations. */
async function readVersion(network: Network, contractId: string): Promise<number> {
	try {
		return Number(await readContract(network, contractId, "version"));
	} catch (error) {
		if (error instanceof ContractReadError) return 0;
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

/**
 * Everything the app shows about one organization, read from its contract in two rounds.
 * `history` is where this device keeps the ledger history read so far.
 */
export async function readOrganization(
	network: Network,
	contractId: string,
	history: HistoryCache | null = null,
): Promise<OnchainSnapshot> {
	const [
		info,
		policy,
		assets,
		members,
		requests,
		setupPhase,
		policyHash,
		limitRows,
		budgetRows,
		standingOrderRows,
		version,
		payeeRows,
		linkRows,
	] = await Promise.all([
		readContract(network, contractId, "info") as Promise<Native>,
		readContract(network, contractId, "policy") as Promise<Native>,
		readContract(network, contractId, "assets") as Promise<Native[]>,
		readContract(network, contractId, "members") as Promise<Native[]>,
		readContract(network, contractId, "requests", [u32(0), u32(REQUEST_PAGE)]) as Promise<Native[]>,
		readContract(network, contractId, "is_setup_phase") as Promise<boolean>,
		readContract(network, contractId, "policy_hash") as Promise<Uint8Array>,
		readSpendingLimits(network, contractId),
		readBudgets(network, contractId),
		readStandingOrders(network, contractId),
		readVersion(network, contractId),
		readPayees(network, contractId),
		readLinks(network, contractId),
	]);
	const limits = new Map(
		limitRows.map((row) => [String(row.member), mapLimit(row.limit as Native)] as const),
	);
	const tokens = assets.map((asset) => String(asset.token));
	const known = history?.load(contractId) ?? null;
	const [escrows, balances, reserves, page] = await Promise.all([
		readEscrows(network, contractId, requests),
		readBalances(network, contractId, tokens),
		readReserves(network, contractId, assets),
		// The ledger's own record of money in and out. A failed read keeps what this device has
		// rather than hiding the organization; the next read tries again.
		readTransfers(network, contractId, tokens, known).catch((): HistoryPage | null => null),
	]);
	if (page && page !== known) history?.save(contractId, page);
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
		escrows,
		transfers: (page ?? known)?.transfers ?? [],
		standingOrders: standingOrderRows,
		addressBook: payeeRows,
		paymentLinks: linkRows,
		setupPhase,
		policyHash: hex(policyHash),
		version,
	};
}

/** Held handovers carry their confirmations in a separate entry. */
async function readEscrows(
	network: Network,
	contractId: string,
	requests: Native[],
): Promise<Map<string, Native>> {
	return new Map(
		await Promise.all(
			requests
				.filter((request) => statusName(request.status) === "Escrowed")
				.map(async (request) => {
					const id = String(request.id);
					const state = (await readContract(network, contractId, "escrow", [
						u64(Number(id)),
					])) as Native;
					return [id, state] as const;
				}),
		),
	);
}

/** One balance per accepted token, from the token contracts themselves. */
async function readBalances(
	network: Network,
	contractId: string,
	tokens: readonly string[],
): Promise<Map<string, bigint>> {
	return new Map(
		await Promise.all(
			tokens.map(async (token) => [token, await tokenBalance(network, token, contractId)] as const),
		),
	);
}

/** The Reserve of each asset that has a vault: value today and the principal moved in. */
async function readReserves(
	network: Network,
	contractId: string,
	assets: Native[],
): Promise<Map<string, { value: bigint; principal: bigint }>> {
	return new Map(
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
