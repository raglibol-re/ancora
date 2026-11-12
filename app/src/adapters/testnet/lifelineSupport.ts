import type { xdr } from "@stellar/stellar-sdk";
import type { LifelineSupport } from "../../domain/dataSource.ts";
import type { RecoveryPlan } from "../../domain/lifeline.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { readClaimStatus, readOverview, recoveryMessage, setPlanArgs } from "./lifelineContract.ts";
import { address } from "./scv.ts";
import type { TestnetConfig } from "./testnetConfig.ts";

// Lifeline: a person's recovery plan and a guardian's claim, on ancora's recovery contract.

/** How long several screens share one read of a person's Lifeline overview. */
const OVERVIEW_KEEP_MS = 20_000;
const MEMO_PREFIX = "lifeline:";

type Deps = {
	config: TestnetConfig;
	invoke: (
		target: string,
		fn: string,
		args: xdr.ScVal[],
		describeContractError?: (message: string) => string,
	) => Promise<Result<void, RuleError>>;
	post: <T>(path: string, body: Record<string, unknown>) => Promise<Result<T, RuleError>>;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
	/** A read shared for `ttlMs` by everyone who asks under the same key. */
	remember: <T>(key: string, ttlMs: number, load: () => Promise<T>) => Promise<T>;
	/** Drops the shared reads whose key starts with the prefix. */
	forget: (prefix: string) => void;
};

export function createLifelineSupport(deps: Deps): LifelineSupport {
	const { config } = deps;

	const change = async (fn: string, args: xdr.ScVal[]) => {
		const result = await deps.invoke(config.recoveryContract, fn, args, recoveryMessage);
		deps.forget(MEMO_PREFIX);
		return result;
	};

	const read = async <T>(reader: () => Promise<T>): Promise<Result<T, RuleError>> => {
		try {
			return ok(await reader());
		} catch (error) {
			return deps.failed(
				error instanceof Error
					? `Lifeline couldn't be read right now. ${error.message}`
					: "Lifeline couldn't be read right now.",
			);
		}
	};

	return {
		overview: (person) =>
			deps.remember(`${MEMO_PREFIX}${person}`, OVERVIEW_KEEP_MS, () =>
				read(() => readOverview(config, config.recoveryContract, person)),
			),
		claimOf: (person) => read(() => readClaimStatus(config, config.recoveryContract, person)),
		setPlan: (person, plan: RecoveryPlan) => change("set_plan", setPlanArgs(person, plan)),
		clearPlan: (person) => change("clear_plan", [address(person)]),
		startClaim: (person, guardian, successor) =>
			change("start_claim", [address(person), address(guardian), address(successor)]),
		approveClaim: (person, guardian) =>
			change("approve_claim", [address(person), address(guardian)]),
		cancelClaim: (person) => change("cancel_claim", [address(person)]),
		finishClaim: async (person) => {
			const result = await deps.post<{
				successor: string | null;
				recovered: string[];
				skipped: string[];
			}>("/api/finish-recovery", { person });
			if (!result.ok) return result;
			await deps.refresh();
			return ok({ ...result.value, successor: result.value.successor ?? "" });
		},
	};
}
