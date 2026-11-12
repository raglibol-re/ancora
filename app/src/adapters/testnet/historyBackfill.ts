import type { HistoryCache } from "./historyCache.ts";
import type { OnchainSnapshot } from "./mapOrganization.ts";
import { backfillTransfers, merge } from "./orgHistory.ts";
import type { Network } from "./readContract.ts";

/**
 * An organization loads with only its newest ledger history; the rest of RPC's week is read
 * here afterwards, one organization at a time. Answers the snapshots with the older transfers
 * added, or null when nothing older was found.
 */
export async function backfillHistory(
	network: Network,
	history: HistoryCache,
	snapshots: readonly OnchainSnapshot[],
): Promise<OnchainSnapshot[] | null> {
	const filled: OnchainSnapshot[] = [];
	let grew = false;
	for (const snapshot of snapshots) {
		const known = history.load(snapshot.contractId);
		const tokens = snapshot.assets.map((asset) => String(asset.token));
		const older = known
			? await backfillTransfers(network, snapshot.contractId, tokens, known).catch(() => null)
			: null;
		if (!older) {
			filled.push(snapshot);
			continue;
		}
		// A refresh may have read newer ledgers meanwhile; the saved page keeps both.
		const page = merge(older, history.load(snapshot.contractId));
		history.save(snapshot.contractId, page);
		filled.push({ ...snapshot, transfers: page.transfers });
		grew = true;
	}
	return grew ? filled : null;
}
