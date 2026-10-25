import { type FormEvent, useEffect, useState } from "react";
import { type OrgAccount, shortAddress } from "../../domain/account.ts";
import type { ConnectedWallet } from "../../domain/dataSource.ts";
import { parseAmountInput } from "../../domain/money.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Sheet } from "../../ui/Sheet.tsx";
import { useNotify } from "../notices/NoticeContext.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AddMoneySheet.module.css";

type AddMoneySheetProps = {
	account: OrgAccount;
	asset: Asset;
	open: boolean;
	onClose: () => void;
};

/**
 * Ways to get `asset` onto the organization's account on testnet: from the person's own Stellar
 * wallet (ancora builds the transfer, the wallet signs), test money from the operator, or by
 * sending to the organization's address from a wallet that can pay contract addresses.
 */
export function AddMoneySheet({ account, asset, open, onClose }: AddMoneySheetProps) {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const notify = useNotify();
	const funding = dataSource.funding;
	const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
	const [held, setHeld] = useState<number | null>(null);
	const [assetName, setAssetName] = useState<string | null>(null);
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const amount = parseAmountInput(input);
	const orgAddress = account.onchain?.contractId ?? account.org.id;

	useEffect(() => {
		if (!open || !funding) return;
		let cancelled = false;
		void funding.assetName(asset.token).then((name) => {
			if (!cancelled) setAssetName(name);
		});
		return () => {
			cancelled = true;
		};
	}, [open, funding, asset.token]);

	useEffect(() => {
		if (!wallet || !funding) return;
		let cancelled = false;
		void funding.walletBalance(asset.token, wallet.address).then((balance) => {
			if (!cancelled) setHeld(balance);
		});
		return () => {
			cancelled = true;
		};
	}, [wallet, funding, asset.token]);

	const connect = async () => {
		if (!funding) return;
		const result = await run(() => funding.connectWallet());
		if (result?.ok) setWallet(result.value);
	};

	const disconnect = async () => {
		await funding?.disconnectWallet();
		setWallet(null);
		setHeld(null);
	};

	const deposit = async (event: FormEvent) => {
		event.preventDefault();
		if (!funding || !wallet) return;
		if (amount === null) {
			setError("Enter an amount like 25 or 100.50.");
			return;
		}
		setError(null);
		const result = await run(
			() => funding.depositFromWallet(account.org.id, asset.token, wallet.address, amount),
			{
				success: `${formatMoney(amount, asset.currency)} ${asset.symbol} arrived from your wallet.`,
			},
		);
		if (result?.ok) {
			setInput("");
			onClose();
		}
	};

	const testMoney = () =>
		run(() => dataSource.addTestMoney(account.org.id, me.id, asset.token), {
			success: `Test ${asset.symbol} arrived on the account.`,
		});

	const copyAddress = async () => {
		try {
			await navigator.clipboard.writeText(orgAddress);
			notify({ tone: "success", text: "Organization address copied." });
		} catch {
			notify({ tone: "error", text: "Couldn't copy. Select the address and copy it by hand." });
		}
	};

	const issuer = assetName?.includes(":") ? assetName.split(":")[1] : null;

	return (
		<Sheet open={open} title={`Add ${asset.symbol}`} onClose={onClose}>
			<div className={styles.sections}>
				{funding && (
					<section className={styles.section}>
						<h3>From your wallet</h3>
						<p className={styles.muted}>
							Freighter, Hana, xBull or Albedo on testnet. ancora prepares the transfer to the
							organization's contract; your wallet only signs it.
						</p>
						{wallet ? (
							<form className={styles.form} onSubmit={deposit}>
								<p className={styles.wallet}>
									<strong>{wallet.walletName}</strong> · {shortAddress(wallet.address)}
									{held !== null && ` · holds ${formatMoney(held, asset.currency)} ${asset.symbol}`}
									<button type="button" className={styles.linkButton} onClick={disconnect}>
										Disconnect
									</button>
								</p>
								{held === 0 && (
									<p className={styles.warning}>
										This wallet holds none of this asset. It needs a trustline for exactly{" "}
										{assetName ?? asset.symbol}
										{issuer ? ` (issuer ${shortAddress(issuer)})` : ""} and some balance.
									</p>
								)}
								<Field label={`Amount (${asset.currency})`} htmlFor="deposit-amount" error={error}>
									<input
										id="deposit-amount"
										className={controlClass}
										inputMode="decimal"
										autoComplete="off"
										placeholder="0.00"
										value={input}
										onChange={(e) => setInput(e.target.value)}
									/>
								</Field>
								<button
									type="submit"
									className={buttonClass()}
									disabled={busy || amount === null || (held !== null && amount > held)}
								>
									{busy
										? "Waiting for your wallet…"
										: `Send ${asset.symbol} to ${account.org.name}`}
								</button>
							</form>
						) : (
							<button type="button" className={buttonClass()} disabled={busy} onClick={connect}>
								Connect wallet
							</button>
						)}
					</section>
				)}

				<section className={styles.section}>
					<h3>Test money</h3>
					<p className={styles.muted}>
						ancora's demo operator sends test {asset.symbol} from its float. Not real money.
					</p>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={testMoney}
					>
						Add test {asset.symbol}
					</button>
				</section>

				<section className={styles.section}>
					<h3>From any other wallet</h3>
					<p className={styles.muted}>
						Send {asset.symbol}
						{issuer ? ` (issuer ${shortAddress(issuer)})` : ""} to the organization's address with a
						wallet that can pay contract addresses (Freighter can; a plain Stellar payment from Hana
						or Lobstr can't reach a C… address).
					</p>
					<code className={styles.code}>{orgAddress}</code>
					<div>
						<button type="button" className={buttonClass("secondary")} onClick={copyAddress}>
							Copy address
						</button>
					</div>
				</section>
			</div>
		</Sheet>
	);
}
