import { useEffect, useRef, useState } from "react";
import type { AnchorTransaction } from "../../domain/dataSource.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

const POLL_MS = 4_000;

/** SEP-24 statuses after which the anchor changes nothing more. */
export const FINAL_ANCHOR_STATUSES: ReadonlySet<string> = new Set([
	"completed",
	"error",
	"expired",
	"refunded",
	"no_market",
	"too_small",
	"too_large",
]);

/** Follows one anchor transaction until it ends; `onStatus` fires once per new status. */
export function useAnchorTransaction(
	wallet: string | null,
	id: string | null,
	onStatus?: (transaction: AnchorTransaction) => void,
) {
	const { dataSource } = useWorkspace();
	const [record, setRecord] = useState<AnchorTransaction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const callback = useRef(onStatus);
	callback.current = onStatus;

	useEffect(() => {
		const ramps = dataSource.ramps;
		if (!ramps || !wallet || !id) return;
		let cancelled = false;
		let lastStatus = "";
		let timer: ReturnType<typeof setTimeout> | undefined;
		const poll = async () => {
			const result = await ramps.transaction(wallet, id);
			if (cancelled) return;
			if (result.ok) {
				setError(null);
				setRecord(result.value);
				if (result.value.status !== lastStatus) {
					lastStatus = result.value.status;
					callback.current?.(result.value);
				}
				if (FINAL_ANCHOR_STATUSES.has(result.value.status)) return;
			} else {
				setError(result.error.message);
			}
			timer = setTimeout(poll, POLL_MS);
		};
		void poll();
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			setRecord(null);
			setError(null);
		};
	}, [dataSource.ramps, wallet, id]);

	return { record, error };
}

/** Plain language for a SEP-24 status, from the person's point of view. */
export function describeAnchorStatus(transaction: AnchorTransaction, symbol: string): string {
	const deposit = transaction.kind === "deposit";
	switch (transaction.status) {
		case "incomplete":
			return "Finish the anchor's form in the window that opened.";
		case "pending_user_transfer_start":
			return deposit
				? "The anchor is waiting for your bank transfer."
				: "The anchor is ready: it now expects the organization's payment.";
		case "pending_user_transfer_complete":
			return "The anchor received the money and is finishing up.";
		case "pending_anchor":
		case "pending_external":
		case "pending_stellar":
			return deposit
				? `The anchor is sending ${symbol} to your wallet.`
				: "The anchor is paying out to the bank account.";
		case "pending_trust":
			return `Your wallet needs a trustline for ${symbol} before the anchor can send it. Add it in your wallet; the anchor continues on its own.`;
		case "completed":
			return deposit
				? `Done: ${transaction.amountOut ? `${transaction.amountOut} ` : ""}${symbol} arrived in your wallet.`
				: "Done: the anchor paid the bank account.";
		case "refunded":
			return "The anchor refunded this transaction.";
		case "expired":
			return "This transaction expired at the anchor. Start again.";
		case "error":
			return transaction.message
				? `The anchor reported an error: ${transaction.message}`
				: "The anchor reported an error.";
		default:
			return (
				transaction.message ?? `Status at the anchor: ${transaction.status.replaceAll("_", " ")}.`
			);
	}
}
