import { Contract, type Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import { readView } from "./contracts.js";
import { invokeAsServer } from "./ledger.js";
import { listOrganizations } from "./organizationIndex.js";
import type { ServerConfig } from "./serverConfig.js";

// The scheduler behind standing orders: visits every known organization, reads its standing
// orders and runs the ones that are due. The contract lets anyone run a due order (the member
// authorized the schedule when setting it); the operator only pays the fee. A run the rules
// refuse (no funds, hard budget) is reported and tried again next time.

export type DueRun = {
	organization: string;
	orderId: number;
	hash?: string;
	error?: string;
};

export type DueOrdersReport = {
	organizations: number;
	due: number;
	runs: DueRun[];
	/** Organizations whose standing orders could not be read (older code, or RPC trouble). */
	unreadable: number;
};

/** Standing orders of one organization as the contract returns them; empty when it has none. */
async function standingOrdersOf(
	config: ServerConfig,
	organization: string,
): Promise<Record<string, unknown>[] | null> {
	try {
		const rows = await readView(config, organization, "standing_orders");
		return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
	} catch {
		// Organizations created before standing orders existed have no such view.
		return null;
	}
}

export async function runDueOrders(
	config: ServerConfig,
	operator: Keypair,
	nowSeconds = Math.floor(Date.now() / 1000),
): Promise<DueOrdersReport> {
	const organizations = await listOrganizations();
	const report: DueOrdersReport = {
		organizations: organizations.length,
		due: 0,
		runs: [],
		unreadable: 0,
	};
	for (const organization of organizations) {
		const orders = await standingOrdersOf(config, organization);
		if (orders === null) {
			report.unreadable += 1;
			continue;
		}
		for (const order of orders) {
			if (order.active !== true || Number(order.next_at) > nowSeconds) continue;
			report.due += 1;
			const orderId = Number(order.id);
			try {
				const hash = await invokeAsServer(
					config,
					operator,
					new Contract(organization).call(
						"run_standing_order",
						nativeToScVal(orderId, { type: "u64" }),
					),
				);
				report.runs.push({ organization, orderId, hash });
			} catch (error) {
				report.runs.push({
					organization,
					orderId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}
	return report;
}

/**
 * Requests whose objection window has passed are executed too: the decision was taken when the
 * approvals completed, and anyone may call `execute`; members no longer need to press "Send now".
 */
export async function runDueRequests(
	config: ServerConfig,
	operator: Keypair,
	nowSeconds = Math.floor(Date.now() / 1000),
): Promise<DueRun[]> {
	const runs: DueRun[] = [];
	for (const organization of await listOrganizations()) {
		const requests = (await readView(config, organization, "requests", [
			nativeToScVal(0, { type: "u32" }),
			nativeToScVal(50, { type: "u32" }),
		]).catch(() => [])) as Record<string, unknown>[];
		for (const request of requests) {
			const status = Array.isArray(request.status) ? request.status[0] : request.status;
			const after = request.execute_after;
			if (status !== "Scheduled" || after === null || after === undefined) continue;
			if (Number(after) > nowSeconds) continue;
			const requestId = Number(request.id);
			try {
				const hash = await invokeAsServer(
					config,
					operator,
					new Contract(organization).call("execute", nativeToScVal(requestId, { type: "u64" })),
				);
				runs.push({ organization, orderId: requestId, hash });
			} catch (error) {
				runs.push({
					organization,
					orderId: requestId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}
	return runs;
}
