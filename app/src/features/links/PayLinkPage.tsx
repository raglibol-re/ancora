import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type { PublicLink } from "../../adapters/testnet/publicLink.ts";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatMoney } from "../../ui/format.ts";
import styles from "./PayLinkPage.module.css";

type Wallet = { address: string; walletName: string; balance: number | null };

const payer = () => import("../../adapters/testnet/publicLink.ts");

/**
 * The page behind a payment link: anyone pays an organization's invoice or fee from their own
 * Stellar wallet, without an ancora pass. The organization's contract records who paid.
 */
export function PayLinkPage() {
	const { orgId = "", linkId = "" } = useParams();
	const [link, setLink] = useState<PublicLink | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [wallet, setWallet] = useState<Wallet | null>(null);
	const [working, setWorking] = useState<string | null>(null);
	const [paid, setPaid] = useState<string | null>(null);
	const pickerHost = useRef<HTMLDivElement>(null);

	useEffect(() => {
		document.title = "Pay with ancora";
		void payer()
			.then((m) => m.readPublicLink(orgId, linkId))
			.then((result) => (result.ok ? setLink(result.value) : setProblem(result.error.message)));
	}, [orgId, linkId]);

	const connect = async () => {
		if (!link) return;
		setProblem(null);
		setWorking("Choose your wallet…");
		const m = await payer();
		const result = await m.connectWallet(pickerHost.current ?? undefined);
		if (!result.ok) {
			setProblem(result.error.message);
		} else {
			const balance = await m.balanceOf(link.token, result.value.address).catch(() => null);
			setWallet({ ...result.value, balance });
		}
		setWorking(null);
	};

	const pay = async () => {
		if (!link || !wallet) return;
		setProblem(null);
		setWorking("Confirm in your wallet, then the payment goes to Stellar…");
		const result = await (await payer()).payLink(link, linkId, wallet.address);
		setWorking(null);
		if (result.ok) setPaid(result.value);
		else setProblem(result.error.message);
	};

	return (
		<main className={styles.page}>
			<Link to="/" className={styles.brand} aria-label="ancora">
				<BrandMark size={32} />
			</Link>
			<section className={styles.card} aria-live="polite">
				{!link && !problem && (
					<p className={styles.muted}>Reading the payment link from Stellar…</p>
				)}
				{link && (
					<>
						<p className={styles.kicker}>{link.orgName} asks for</p>
						<p className={styles.amount}>
							{formatMoney(link.amount, link.currency)} <span>{link.symbol}</span>
						</p>
						<p className={styles.memo}>{link.memo}</p>
						{link.maxPayments > 1 && (
							<p className={styles.muted}>
								Paid by {link.paidCount} of up to {link.maxPayments} people.
							</p>
						)}
					</>
				)}
				{paid && (
					<div className={styles.done} role="status">
						<strong>Paid. Thank you.</strong> {link?.orgName} sees your payment now.
						<ExplorerLink target={paid}>View the transaction</ExplorerLink>
					</div>
				)}
				{link && !paid && !link.open && (
					<p className={styles.muted}>This link is closed or fully paid. Nothing to pay here.</p>
				)}
				{link && !paid && link.open && (
					<>
						{wallet ? (
							<>
								<p className={styles.muted}>
									From {wallet.walletName} · {wallet.address.slice(0, 4)}…{wallet.address.slice(-4)}
									{wallet.balance !== null &&
										` · holds ${formatMoney(wallet.balance, link.currency)} ${link.symbol}`}
								</p>
								<button
									type="button"
									className={buttonClass()}
									disabled={working !== null}
									onClick={() => void pay()}
								>
									Pay {formatMoney(link.amount, link.currency)}
								</button>
							</>
						) : (
							<button
								type="button"
								className={buttonClass()}
								disabled={working !== null}
								onClick={() => void connect()}
							>
								Pay with a Stellar wallet
							</button>
						)}
						<p className={styles.small}>
							Freighter, xBull, Hana or Albedo on the Stellar testnet. Your wallet needs some XLM
							for the fee and a trustline for {link.symbol}. Test money only; nothing real moves.
						</p>
					</>
				)}
				{working && (
					<p className={styles.working} role="status">
						<span className={styles.ring} aria-hidden="true" />
						{working}
					</p>
				)}
				{problem && (
					<p className={styles.error} role="alert">
						{problem}
					</p>
				)}
				<div ref={pickerHost} />
			</section>
			<p className={styles.small}>
				Payments go straight to {link?.orgName ?? "the organization"}'s account on Stellar. ancora
				is not a bank and never holds the money.
			</p>
		</main>
	);
}
