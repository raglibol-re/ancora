import type { OrgAccount } from "../../../domain/account.ts";
import type { PotStatus } from "../../../domain/dataSource.ts";
import type { KeyringReads } from "../keyringReads.ts";
import type { Network } from "../readContract.ts";
import { toCents } from "../scv.ts";
import { type PotAccount, readPotAccount, readPotEvents } from "./potChain.ts";
import { type Hasher, loadHasher } from "./potHash.ts";
import { type PotKeys, potKeys } from "./potKeys.ts";
import { readPotRoot } from "./potRoot.ts";
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

export async function loadPot(deps: PotDeps, orgId: string, person: string): Promise<PotLoad> {
	const account = deps.account(orgId);
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
	const events = await readPotEvents(deps.network, pot, orgId);
	const balance = replay(hasher, potKeysOf, orgId, events, onChain);
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
