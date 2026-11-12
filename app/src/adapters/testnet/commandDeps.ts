import type { xdr } from "@stellar/stellar-sdk";
import type { OrgAccount } from "../../domain/account.ts";
import type { Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import type { AssetOption, TestnetConfig } from "./testnetConfig.ts";

/** What an organization's commands need from the signed-in session they run in. */
export type CommandDeps = {
	config: TestnetConfig;
	availableAssets: readonly AssetOption[];
	/** The signed-in person's account, or null when nobody is signed in. */
	me: () => string | null;
	/** The organization as last read from the chain. */
	account: (orgId: string) => OrgAccount | undefined;
	/** Calls a contract through the person's account, then reads the chain again. */
	invoke: (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;
	/** Calls one of ancora's own routes. */
	post: <T = unknown>(path: string, body: Record<string, unknown>) => Promise<Result<T, RuleError>>;
	refresh: () => Promise<void>;
	/** A note as it is stored: encrypted when the organization keeps references private. */
	protectNote: (
		orgId: string,
		actorId: PersonId,
		text: string,
		onChain: boolean,
	) => Promise<Result<string, RuleError>>;
	failed: (message: string) => Result<never, RuleError>;
	/** Keeps a failure that didn't stop the command, for the admin page's recent errors. */
	recordFailure: (where: string, error: unknown) => void;
};
