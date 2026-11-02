import type { OrgAccount } from "../../../domain/account.ts";
import type { PotStatus } from "../../../domain/dataSource.ts";
import type { KeyringReads } from "../keyringReads.ts";
import type { Network } from "../readContract.ts";
import { toCents } from "../scv.ts";
import { type PotAccount, readPotAccount, readPotEvents } from "./potChain.ts";
import { type Hasher, loadHasher } from "./potHash.ts";
import { type PotKeys, potKeys } from "./potKeys.ts";
import { readPotRoot } from "./potRoot.ts";
import { loadSnapshot, saveSnapshot } from "./potSnapshot.ts";
import { type PotBalance, replay } from "./potWallet.ts";

// Everything the pot needs before showing a balance or proving: the organization may use it,
// this device holds the pot key, the account exists, and its history explains the chain.

export type PotConfig = { pot: string; verifier: string; auditors: string; asset: string };

export type PotDeps = {
	network: Network;
	config: PotConfig;
	reads: KeyringReads;
	account: (orgId: string) => OrgAccount | undefined;
};

/** A pot that is open and readable on this device. */
export type OpenPot = {
	hasher: Hasher;
	keys: PotKeys;
	onChain: PotAccount;
	balance: PotBalance;
};

export type PotLoad =
	| { state: "unavailable"; reason: string }
	| { state: "closed" | "opening" | "unreadable" }
	| ({ state: "open" } & OpenPot);

/** `account` is the organization as read, for someone outside it (an auditor). */
export async function loadPot(
	deps: PotDeps,
	orgId: string,
	person: string,
	account: OrgAccount | undefined = deps.account(orgId),
): Promise<PotLoad> {
	if (!account?.onchain?.pot) {
		return {
			state: "unavailable",
			reason:
				"This organization's code predates the pot. Move to the latest release under Settings → Organization code.",
		};
	}
	const [epoch, keys] = await Promise.all([
		deps.reads.epochOf(orgId),
		deps.reads.keysFor(orgId, person),
	]);
	if (epoch === 0) {
		return {
			state: "unavailable",
			reason:
				"Turn on private details first (Settings → Private details): the pot key travels the same way.",
		};
	}
	if (!keys.has(epoch)) {
		return {
			state: "unavailable",
			reason:
				"This device can't read the organization's private details yet. Set it up and ask a member to share access.",
		};
	}
	const { pot } = deps.config;
	const [stored, onChain] = await Promise.all([
		readPotRoot(deps.reads, orgId, person, pot),
		readPotAccount(deps.network, pot, orgId),
	]);
	if (!onChain) return { state: stored ? "opening" : "closed" };
	if (!stored) {
		return { state: "unavailable", reason: "The pot key isn't readable on this device." };
	}
	const hasher = await loadHasher();
	const potKeysOf = await potKeys(hasher, stored.root, pot, orgId);
	if (!potKeysOf.spendingKey.equals(onChain.spendingKey)) {
		return {
			state: "unavailable",
			reason: "The pot key in the keyring doesn't match the pot account.",
		};
	}
	const balance = await readBalance(deps, hasher, potKeysOf, orgId, onChain);
	if (!balance) return { state: "unreadable" };
	return { state: "open", hasher, keys: potKeysOf, onChain, balance };
}

/** What the page shows. */
export function statusOf(load: PotLoad): PotStatus {
	if (load.state !== "open") return load;
	const { balance } = load;
	return {
		state: "open",
		spendable: toCents(balance.spendable.value),
		incoming: toCents(balance.receiving.value),
		entries: balance.entries.map((entry) => ({ ...entry, amount: toCents(entry.amount) })),
	};
}

/**
 * The balance from this device's snapshot and the events since, or from the whole history the
 * RPC keeps when there is no snapshot or it no longer explains the chain; saved for next time.
 */
async function readBalance(
	deps: PotDeps,
	hasher: Hasher,
	keys: PotKeys,
	orgId: string,
	onChain: PotAccount,
): Promise<PotBalance | null> {
	const { pot } = deps.config;
	const snapshot = await loadSnapshot(keys, pot, orgId);
	let read = await readPotEvents(deps.network, pot, orgId, snapshot?.toLedger ?? null);
	let balance = replay(hasher, keys, orgId, read.events, onChain, snapshot?.balance ?? null);
	if (!balance && snapshot) {
		read = await readPotEvents(deps.network, pot, orgId);
		balance = replay(hasher, keys, orgId, read.events, onChain);
	}
	if (balance) await saveSnapshot(keys, pot, orgId, { toLedger: read.toLedger, balance });
	return balance;
}
