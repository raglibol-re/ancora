import type { KeyValueStorage } from "../local/workspaceStore.ts";
import type { ChainTransfer, HistoryPage } from "./orgHistory.ts";

// The ledger history read so far, per organization, kept on this device. RPC forgets events
// after about a week, so each visit scans only the ledgers since the last one, and movements
// stay listed beyond that week. Public data; nothing here can act.

const PREFIX = "ancora.history.v1:";

type StoredTransfer = Omit<ChainTransfer, "amount"> & { amount: string };
type Stored = { fromLedger: number; toLedger: number; transfers: StoredTransfer[] };

export type HistoryCache = {
	load(organization: string): HistoryPage | null;
	save(organization: string, page: HistoryPage): void;
};

export function historyCache(storage: KeyValueStorage | null): HistoryCache {
	return {
		load(organization) {
			try {
				const parsed: unknown = JSON.parse(storage?.getItem(PREFIX + organization) ?? "null");
				if (!parsed || typeof parsed !== "object") return null;
				const stored = parsed as Partial<Stored>;
				if (
					typeof stored.fromLedger !== "number" ||
					typeof stored.toLedger !== "number" ||
					!Array.isArray(stored.transfers)
				) {
					return null;
				}
				return {
					fromLedger: stored.fromLedger,
					toLedger: stored.toLedger,
					transfers: stored.transfers.map((transfer) => ({
						...transfer,
						amount: BigInt(transfer.amount),
					})),
				};
			} catch {
				// Corrupt or blocked storage: the whole window is read again.
				return null;
			}
		},
		save(organization, page) {
			try {
				const stored: Stored = {
					fromLedger: page.fromLedger,
					toLedger: page.toLedger,
					transfers: page.transfers.map((transfer) => ({
						...transfer,
						amount: transfer.amount.toString(),
					})),
				};
				storage?.setItem(PREFIX + organization, JSON.stringify(stored));
			} catch {
				// Full or blocked storage: the next visit scans the window again.
			}
		},
	};
}
