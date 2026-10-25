import { useEffect, useState } from "react";
import type { AnchorInfo, AnchorSession, ConnectedWallet } from "../../domain/dataSource.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AddMoneySheet.module.css";
import {
	describeAnchorStatus,
	FINAL_ANCHOR_STATUSES,
	useAnchorTransaction,
} from "./useAnchorTransaction.ts";

type BankDepositSectionProps = {
	asset: Asset;
	wallet: ConnectedWallet | null;
	busy: boolean;
	onConnect: () => void;
	/** The deposit completed: the wallet now holds the money. */
	onArrived: () => void;
};

/**
 * A bank deposit through the configured Stellar anchor (SEP-24): the wallet signs in, the
 * anchor's own form takes the bank details, the asset lands in the wallet. Rendered only for
 * assets the anchor handles.
 */
export function BankDepositSection({
	asset,
	wallet,
	busy,
	onConnect,
	onArrived,
}: BankDepositSectionProps) {
	const { dataSource } = useWorkspace();
	const ramps = dataSource.ramps;
	const { run, busy: starting } = useCommand();
	const [info, setInfo] = useState<AnchorInfo | null>(null);
	const [session, setSession] = useState<AnchorSession | null>(null);
	const { record, error } = useAnchorTransaction(
		wallet?.address ?? null,
		session?.id ?? null,
		(transaction) => {
			if (transaction.status === "completed") onArrived();
		},
	);

	useEffect(() => {
		if (!ramps) return;
		let cancelled = false;
		void ramps.info().then((result) => {
			if (!cancelled && result.ok) setInfo(result.value);
		});
		return () => {
			cancelled = true;
		};
	}, [ramps]);

	if (!ramps || !info?.depositable.includes(asset.token)) return null;

	const start = async () => {
		if (!wallet) return;
		const result = await run(() => ramps.startDeposit(asset.token, wallet.address));
		if (result?.ok) setSession(result.value);
	};

	return (
		<section className={styles.section}>
			<h3>From a bank account</h3>
			<p className={styles.muted}>
				Through the Stellar anchor {info.homeDomain} (testnet: a test bank, no real money). Your
				wallet signs in, the anchor's form takes the bank details, the {asset.symbol} arrives in
				your wallet, and from there it goes to the organization.
			</p>
			{!wallet ? (
				<button type="button" className={buttonClass()} disabled={busy} onClick={onConnect}>
					Connect wallet
				</button>
			) : session ? (
				<>
					<div>
						<a
							className={buttonClass()}
							href={session.url}
							target="_blank"
							rel="noopener noreferrer"
						>
							Open the anchor's form
						</a>
					</div>
					<p className={styles.muted} aria-live="polite">
						{error ??
							(record ? describeAnchorStatus(record, asset.symbol) : "Waiting for the anchor…")}
					</p>
					{record && FINAL_ANCHOR_STATUSES.has(record.status) && (
						<button type="button" className={styles.linkButton} onClick={() => setSession(null)}>
							Start another deposit
						</button>
					)}
				</>
			) : (
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy || starting}
					onClick={start}
				>
					{starting ? "Signing in with the anchor…" : "Start a bank deposit"}
				</button>
			)}
		</section>
	);
}
