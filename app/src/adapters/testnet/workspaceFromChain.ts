import { type OrgAccount, type Person, shortAddress } from "../../domain/account.ts";
import { mapOrganization, type OnchainSnapshot } from "./mapOrganization.ts";
import type { Profile } from "./organizationContract.ts";
import type { AssetOption } from "./testnetConfig.ts";

// Turns what was read from the chain into the accounts and people the app shows.

export type Reading = {
	snapshots: readonly OnchainSnapshot[];
	/** Every account that appears in these organizations, the reader included. */
	everyone: ReadonlySet<string>;
};

type Context = {
	profiles: ReadonlyMap<string, Profile | null>;
	/** The operator's asset list, whose symbols win over what a token calls itself. */
	assets: readonly AssetOption[];
	/** The asset of ancora's confidential pot; null where there is none. */
	potAsset: string | null;
};

/** One organization as the app shows it; `otherNames` names accounts that aren't people. */
export function accountFromChain(
	snapshot: OnchainSnapshot,
	context: Context,
	discussions: OrgAccount["discussions"],
	otherNames: ReadonlyMap<string, string> = new Map(),
): OrgAccount {
	const symbols = new Map(context.assets.map((a) => [a.token, a.symbol]));
	return {
		...mapOrganization(
			snapshot,
			(who) => otherNames.get(who) ?? context.profiles.get(who)?.name ?? undefined,
			Date.now(),
			(token, onchainSymbol) => symbols.get(token) ?? onchainSymbol,
			context.potAsset,
		),
		discussions,
	};
}

/** My organizations and the people in them. Organizations paying each other show by name. */
export function workspaceFromChain(
	reading: Reading,
	context: Context,
	discussionsOf: (orgId: string) => OrgAccount["discussions"] | undefined,
): { people: Person[]; accounts: OrgAccount[] } {
	const orgNames = new Map(reading.snapshots.map((s) => [s.contractId, String(s.info.name)]));
	return {
		accounts: reading.snapshots.map((snapshot) =>
			accountFromChain(snapshot, context, discussionsOf(snapshot.contractId) ?? {}, orgNames),
		),
		people: [...reading.everyone].map((id) => ({
			id,
			name: context.profiles.get(id)?.name ?? shortAddress(id),
			avatarUrl: context.profiles.get(id)?.avatarUrl ?? null,
		})),
	};
}
