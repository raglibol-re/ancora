import { type FormEvent, useState } from "react";
import {
	currencyOf,
	type OrgAccount,
	type PaymentLink,
	shortAddress,
} from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { useNotify } from "../notices/NoticeContext.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./LinksPage.module.css";

export function LinksPage() {
	return (
		<Page
			title="Payment links"
			lead="Ask for money: invoices and membership fees anyone pays from their own wallet."
		>
			<OrgRequired>{(account) => <Links key={account.org.id} account={account} />}</OrgRequired>
		</Page>
	);
}

/** The public page a payer opens; testnet organizations only (their id is a contract address). */
export function linkUrl(account: OrgAccount, link: PaymentLink): string {
	return `${window.location.origin}/pay/${account.org.id}/${link.id}`;
}

function Links({ account }: { account: OrgAccount }) {
	const { dataSource, me, personName, workspace } = useWorkspace();
	const { run, busy } = useCommand();
	const notify = useNotify();
	const [token, setToken] = useState(account.org.assets[0]?.token ?? "");
	const [amountInput, setAmountInput] = useState("");
	const [note, setNote] = useState("");
	const [mode, setMode] = useState<"once" | "many">("once");
	const [count, setCount] = useState("50");
	const [error, setError] = useState<string | null>(null);
	const [qr, setQr] = useState<{ id: string; image: string } | null>(null);
	const links = account.paymentLinks;

	if (links === null) {
		return (
			<Card title="Payment links">
				<p className={styles.muted}>
					This organization was created before payment links existed; organizations created from 28
					Oct 2026 can ask for money with a link.
				</p>
			</Card>
		);
	}

	const payerName = (payer: string) =>
		workspace.people.some((p) => p.id === payer) ? personName(payer) : shortAddress(payer);

	const create = async (event: FormEvent) => {
		event.preventDefault();
		const amount = parseAmountInput(amountInput);
		const maxPayments = mode === "once" ? 1 : Number(count);
		if (amount === null || amount <= 0) {
			setError("Enter an amount like 30 or 120.50.");
			return;
		}
		if (!Number.isInteger(maxPayments) || maxPayments < 1 || maxPayments > 500) {
			setError("A link takes one to 500 payments.");
			return;
		}
		if (!note.trim()) {
			setError("Say what it's for, like Membership 2027 or Invoice 14.");
			return;
		}
		setError(null);
		const result = await run(
			() => dataSource.createLink(account.org.id, me.id, { token, amount, note, maxPayments }),
			{
				signature: { kind: "passkey", title: `Create a payment link: ${note.trim()}` },
				success: "Payment link created. Copy it or show its QR code below.",
			},
		);
		if (result?.ok) {
			setAmountInput("");
			setNote("");
		}
	};

	const copy = async (link: PaymentLink) => {
		try {
			await navigator.clipboard.writeText(linkUrl(account, link));
			notify({ tone: "success", text: "Link copied. Send it to whoever should pay." });
		} catch {
			notify({ tone: "error", text: "Couldn't copy. Open the QR code and share that instead." });
		}
	};

	const showQr = async (link: PaymentLink) => {
		const { toDataURL } = await import("qrcode");
		setQr({
			id: link.id,
			image: await toDataURL(linkUrl(account, link), { margin: 1, width: 240 }),
		});
	};

	return (
		<>
			<Card title="Ask for money">
				<form className={styles.form} onSubmit={create} noValidate>
					<div className={styles.row}>
						{account.org.assets.length > 1 && (
							<Field label="In" htmlFor="link-asset">
								<select
									id="link-asset"
									className={controlClass}
									value={token}
									onChange={(e) => setToken(e.target.value)}
								>
									{account.org.assets.map((a) => (
										<option key={a.token} value={a.token}>
											{a.symbol} ({a.currency})
										</option>
									))}
								</select>
							</Field>
						)}
						<Field label={`Amount (${currencyOf(account, token)})`} htmlFor="link-amount">
							<input
								id="link-amount"
								className={controlClass}
								inputMode="decimal"
								autoComplete="off"
								placeholder="30.00"
								value={amountInput}
								onChange={(e) => setAmountInput(e.target.value)}
							/>
						</Field>
						<Field label="What it's for" htmlFor="link-note">
							<input
								id="link-note"
								className={controlClass}
								maxLength={140}
								placeholder="Membership 2027"
								value={note}
								onChange={(e) => setNote(e.target.value)}
							/>
						</Field>
					</div>
					<Segmented<"once" | "many">
						label="Paid by"
						value={mode}
						onChange={setMode}
						options={[
							{ value: "once", label: "One payer (invoice)" },
							{ value: "many", label: "Several people (fees)" },
						]}
					/>
					{mode === "many" && (
						<Field
							label="At most"
							htmlFor="link-count"
							hint="Each wallet pays once; the link closes when this many have paid."
						>
							<input
								id="link-count"
								className={controlClass}
								inputMode="numeric"
								value={count}
								onChange={(e) => setCount(e.target.value)}
							/>
						</Field>
					)}
					{error && (
						<p className={styles.error} role="alert">
							{error}
						</p>
					)}
					<div>
						<button type="submit" className={buttonClass()} disabled={busy}>
							Create link
						</button>
					</div>
				</form>
			</Card>

			<Card title="Links">
				{links.length === 0 ? (
					<p className={styles.muted}>No payment links yet.</p>
				) : (
					<ul className={styles.list}>
						{links.map((link) => {
							const currency = currencyOf(account, link.token);
							return (
								<li key={link.id} className={styles.link}>
									<div className={styles.head}>
										<span className={styles.title}>
											{link.memo} · {formatMoney(link.amount, currency)}
										</span>
										<span className={link.open ? styles.open : styles.closed}>
											{link.open ? "Open" : "Closed"}
										</span>
									</div>
									<span className={styles.meta}>
										Paid {link.payments.length} of {link.maxPayments} · total{" "}
										{formatMoney(link.amount * link.payments.length, currency)} · created{" "}
										{formatDateTime(link.createdAt)} by {personName(link.createdBy)}
									</span>
									{link.payments.length > 0 && (
										<ul className={styles.payers}>
											{link.payments.map((p) => (
												<li key={`${p.payer}-${p.at}`}>
													{payerName(p.payer)} · {formatDateTime(p.at)}
												</li>
											))}
										</ul>
									)}
									{account.onchain ? (
										<div className={styles.actions}>
											<button
												type="button"
												className={buttonClass("secondary")}
												onClick={() => void copy(link)}
											>
												Copy link
											</button>
											<button
												type="button"
												className={buttonClass("secondary")}
												onClick={() => void showQr(link)}
											>
												QR code
											</button>
											{link.open && (
												<button
													type="button"
													className={buttonClass("secondary")}
													disabled={busy}
													onClick={() =>
														run(() => dataSource.closeLink(account.org.id, me.id, link.id), {
															signature: { kind: "passkey", title: `Close the link ${link.memo}` },
															success: "Link closed. It takes no more payments.",
														})
													}
												>
													Close
												</button>
											)}
										</div>
									) : (
										<p className={styles.muted}>
											Sample data: payers open links of organizations on the Stellar testnet.
										</p>
									)}
									{qr?.id === link.id && (
										<img
											className={styles.qr}
											src={qr.image}
											alt={`QR code for the payment link ${link.memo}`}
										/>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</Card>
		</>
	);
}
