import type { xdr } from "@stellar/stellar-sdk";
import type { DealSupport } from "../../domain/dataSource.ts";
import type { DealAction } from "../../domain/deals.ts";
import type { Result } from "../../domain/result.ts";
import { ok } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import { dealCallToScVal, mapDeal } from "./dealCodec.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u32, u64 } from "./scv.ts";

type Invoke = (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;

type Deps = {
	network: Network;
	contract: string;
	/** Signs a call through the person's account (passkey) and submits it with sponsored fees. */
	invoke: Invoke;
	/** Whether `actorId` may act for the organization directly (founder, setup phase). */
	direct: (orgId: string, actorId: PersonId) => boolean;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
};

/** Deals on the testnet: reads from the deal contract, steps through the organization contract. */
export function createDealSupport(deps: Deps): DealSupport {
	return {
		contract: () => deps.contract,
		list: async (orgId) => {
			try {
				const rows = await readContract(deps.network, deps.contract, "deals_of", [address(orgId)]);
				return ok((rows as Record<string, unknown>[]).map(mapDeal));
			} catch (error) {
				return deps.failed(
					`Couldn't read the deals from Stellar: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
		act: async (orgId, actorId, action: DealAction) => {
			const direct = deps.direct(orgId, actorId);
			const result = await deps.invoke(orgId, direct ? "deal_directly" : "propose_deal", [
				address(actorId),
				dealCallToScVal(deps.contract, action),
			]);
			if (!result.ok) return result;
			await deps.refresh();
			return ok(direct ? "applied" : "requested");
		},
		releaseNow: async (dealId, milestone) => {
			const result = await deps.invoke(deps.contract, "execute_release", [
				u64(dealId),
				u32(milestone),
			]);
			return result.ok ? ok(undefined) : result;
		},
	};
}
