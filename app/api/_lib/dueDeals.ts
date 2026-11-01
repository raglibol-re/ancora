import { Address, Contract, type Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import { readView } from "./contracts.js";
import { invokeAsServer } from "./ledger.js";
import { listOrganizations } from "./organizationIndex.js";
import type { ServerConfig } from "./serverConfig.js";

// Automatic payouts in deals: a milestone B asked for goes out once its objection period passed
// without an objection. The deal contract lets anyone trigger that (the money only goes to B);
// the operator only pays the fee. Deals are found through every known organization.

export type DueRelease = { deal: number; milestone: number; hash?: string; error?: string };

type NativeDeal = {
	id: unknown;
	status: unknown;
	objection_seconds: unknown;
	milestones: { status: unknown; requested_at: unknown }[];
};

const variantName = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/** The milestones whose objection period has passed, one entry per deal and milestone. */
export function dueMilestones(
	deals: readonly NativeDeal[],
	nowSeconds: number,
): { deal: number; milestone: number }[] {
	const due = new Map<string, { deal: number; milestone: number }>();
	for (const deal of deals) {
		if (variantName(deal.status) !== "Active") continue;
		deal.milestones.forEach((milestone, index) => {
			if (variantName(milestone.status) !== "Requested") return;
			const end = Number(milestone.requested_at) + Number(deal.objection_seconds);
			if (end > nowSeconds) return;
			const id = Number(deal.id);
			due.set(`${id}:${index}`, { deal: id, milestone: index });
		});
	}
	return [...due.values()];
}

export async function runDueDeals(
	config: ServerConfig,
	operator: Keypair,
	nowSeconds = Math.floor(Date.now() / 1000),
): Promise<DueRelease[]> {
	if (!config.dealContract) return [];
	const deals: NativeDeal[] = [];
	for (const organization of await listOrganizations()) {
		const rows = await readView(config, config.dealContract, "deals_of", [
			new Address(organization).toScVal(),
		]).catch(() => []);
		if (Array.isArray(rows)) deals.push(...(rows as NativeDeal[]));
	}
	const runs: DueRelease[] = [];
	for (const { deal, milestone } of dueMilestones(deals, nowSeconds)) {
		try {
			const hash = await invokeAsServer(
				config,
				operator,
				new Contract(config.dealContract).call(
					"execute_release",
					nativeToScVal(deal, { type: "u64" }),
					nativeToScVal(milestone, { type: "u32" }),
				),
			);
			runs.push({ deal, milestone, hash });
		} catch (error) {
			runs.push({ deal, milestone, error: error instanceof Error ? error.message : String(error) });
		}
	}
	return runs;
}
