import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { availableBalance, type OrgAccount, shortAddress } from "../../domain/account.ts";
import type { AnchorInfo, AnchorSession, ConnectedWallet } from "../../domain/dataSource.ts";
import { parseAmountInput } from "../../domain/money.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { formatMoney } from "../../ui/format.ts";
import { Sheet } from "../../ui/Sheet.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AddMoneySheet.module.css";
import { describeAnchorStatus, useAnchorTransaction } from "./useAnchorTransaction.ts";

type BankWithdrawSheetProps = {
	account: OrgAccount;
	asset: Asset;
	open: boolean;
	onClose: () => void;
};

/**
 * Money from the organization to a bank account through the anchor (SEP-24 withdrawal): the
 * anchor's form takes the amount and bank details, then ancora turns the anchor's instructions
 * (account and reference) into an ordinary payment request that follows the organization's rules.
 */
export function BankWithdrawSheet({ account, asset, open, onClose }: BankWithdrawSheetProps) {
	const { dataSource, me } = useWorkspace();
	const navigate = useNavigate();
	const { run, busy } = useCommand();
	const ramps = dataSource.ramps;
	const funding = dataSource.funding;
	const [info, setInfo] = useState<AnchorInfo | null>(null);
	const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
	const [session, setSession] = useState<AnchorSession | null>(null);
	// The wallet picker must render inside this open <dialog>; outside of it the page is inert.
	const pickerHost = useRef<HTMLDivElement>(null);
	const { record, error } = useAnchorTransaction(wallet?.address ?? null, session?.id ?? null);

	useEffect(() => {
		if (!open || !ramps) return;
		let cancelled = false;
		void ramps.info().then((result) => {
			if (!cancelled && result.ok) setInfo(result.value);
		});
		return () => {
			cancelled = true;
		};
	}, [open, ramps]);

	if (!ramps || !funding) return null;
	const supported = info?.withdrawable.includes(asset.token) ?? false;
	const amount = record?.amountIn ? parseAmountInput(record.amountIn) : null;
	const available = availableBalance(account, asset.token);
	const instructions = record?.withdrawTo ?? null;

	const connect = async () => {
		const result = await run(() => funding.connectWallet(pickerHost.current ?? undefined));
		if (result?.ok) setWallet(result.value);
	};

	const start = async () => {
		if (!wallet) return;
		const result = await run(() => ramps.startWithdrawal(asset.token, wallet.address));
		if (result?.ok) setSession(result.value);
	};

	const pay = async () => {
		if (!instructions || amount === null || !info) return;
		const result = await run(
			() =>
				dataSource.requestPayment(account.org.id, me.id, {
					payee: { name: `Bank payout via ${info.homeDomain}`, account: instructions.account },
					token: asset.token,
					amount,
					note: instructions.memo,
				}),
			{ success: "Payment request to the anchor created. It follows your rules like any payment." },
		);
		if (result?.ok) {
			onClose();
			navigate(`/app/approvals/${result.value}`);
		}
	};

	return (
		<Sheet open={open} title={`${asset.symbol} to a bank account`} onClose={onClose}>
			<div className={styles.sections}>
				<section className={styles.section}>
					<p className={styles.muted}>
						{info
							? `Through the Stellar anchor ${info.homeDomain} (testnet: a test bank, no real money). Your wallet signs in, the anchor's form takes the amount and the bank details, then ancora creates a payment request from ${account.org.name} to the anchor with the anchor's reference. It needs the same approvals as any payment of that size. Settlement by the test anchor after the organization pays is still being tested.`
							: "Reaching the anchor…"}
					</p>
					{info && !supported && (
						<p className={styles.warning}>
							{info.homeDomain} doesn't pay out {asset.symbol}.
						</p>
					)}
					{supported && !wallet && (
						<button type="button" className={buttonClass()} disabled={busy} onClick={connect}>
							Connect wallet
						</button>
					)}
					{supported && wallet && !session && (
						<>
							<p className={styles.wallet}>
								<strong>{wallet.walletName}</strong> · {shortAddress(wallet.address)}
							</p>
							<button type="button" className={buttonClass()} disabled={busy} onClick={start}>
								{busy ? "Signing in with the anchor…" : "Start a bank withdrawal"}
							</button>
						</>
					)}
					{session && (
						<>
							<div>
								<a
									className={buttonClass(instructions ? "secondary" : "primary")}
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
						</>
					)}
					{instructions && amount !== null && (
						<>
							<p className={styles.muted}>
								The anchor asks for {formatMoney(amount, asset.currency)} {asset.symbol} to{" "}
								{shortAddress(instructions.account)} with reference “{instructions.memo}”.
							</p>
							{amount > available && (
								<p className={styles.warning}>
									Only {formatMoney(available, asset.currency)} is available on the main account.
								</p>
							)}
							<button
								type="button"
								className={buttonClass()}
								disabled={busy || amount > available}
								onClick={pay}
							>
								Create the payment request
							</button>
						</>
					)}
					<div ref={pickerHost} className={styles.pickerHost} />
				</section>
			</div>
		</Sheet>
	);
}
