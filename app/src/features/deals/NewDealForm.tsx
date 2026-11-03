import { StrKey } from "@stellar/stellar-sdk";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { currencyOf, type OrgAccount } from "../../domain/account.ts";
import { MAX_MILESTONES } from "../../domain/deals.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Deals.module.css";

type Row = { label: string; amount: string };

const isStellarAddress = (value: string) =>
	StrKey.isValidContract(value) || StrKey.isValidEd25519PublicKey(value);

async function sha256Hex(file: File): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Proposes a deal with this organization paying; its approval rules decide when it goes out. */
export function NewDealForm({
	account,
	onCreated,
}: {
	account: OrgAccount;
	onCreated: () => void;
}) {
	const t = useT();
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const [counterparty, setCounterparty] = useState("");
	const [token, setToken] = useState(account.org.assets[0]?.token ?? "");
	const [rows, setRows] = useState<Row[]>([{ label: "", amount: "" }]);
	const [days, setDays] = useState("3");
	const [arbiter, setArbiter] = useState("");
	const [document, setDocument] = useState<{ name: string; hash: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const support = dataSource.deals;
	if (!support) return null;
	const currency = currencyOf(account, token);
	const amounts = rows.map((row) => parseAmountInput(row.amount));
	const total = amounts.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);

	const update = (index: number, change: Partial<Row>) =>
		setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

	const pickDocument = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];
		setDocument(file ? { name: file.name, hash: await sha256Hex(file) } : null);
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const partyB = counterparty.trim();
		const objectionSeconds = Math.round(Number(days) * 86_400);
		if (!isStellarAddress(partyB) || partyB === account.org.id) {
			setError(t("Enter the other organization's account address (starts with C or G)."));
			return;
		}
		if (rows.some((row, i) => !row.label.trim() || (amounts[i] ?? 0) <= 0)) {
			setError(t("Every milestone needs a name and an amount above zero."));
			return;
		}
		if (!(objectionSeconds >= 60 && objectionSeconds <= 90 * 86_400)) {
			setError(t("The time to object is between one minute and 90 days."));
			return;
		}
		if (arbiter.trim() && !isStellarAddress(arbiter.trim())) {
			setError(t("The arbiter needs a Stellar account address, or leave it empty."));
			return;
		}
		if (!document) {
			setError(
				t("Attach the agreement; only its fingerprint is recorded, the file stays with you."),
			);
			return;
		}
		setError(null);
		const result = await run(
			() =>
				support.act(account.org.id, me.id, {
					type: "create",
					partyB,
					terms: {
						token,
						milestones: rows.map((row, i) => ({
							label: row.label.trim(),
							amount: amounts[i] ?? 0,
						})),
						objectionSeconds,
						arbiter: arbiter.trim() || null,
						documentHash: document.hash,
					},
				}),
			{
				signature: {
					kind: "passkey",
					title: t("Propose a deal of {amount}", { amount: formatMoney(total, currency) }),
				},
				success: (outcome) =>
					outcome === "applied"
						? t("Deal proposed. The other side can now accept the terms.")
						: t("Approval requested: the deal goes out once your rules are met."),
			},
		);
		if (result?.ok) {
			setRows([{ label: "", amount: "" }]);
			setDocument(null);
			onCreated();
		}
	};

	return (
		<Card title={t("Propose a deal")}>
			<form className={styles.form} onSubmit={submit} noValidate>
				<div className={styles.grid}>
					<Field
						label={t("Other organization")}
						htmlFor="deal-party"
						hint={t("Their account address, from their Settings. ancora names come later.")}
					>
						<input
							id="deal-party"
							className={controlClass}
							placeholder="C…"
							spellCheck={false}
							autoComplete="off"
							value={counterparty}
							onChange={(e) => setCounterparty(e.target.value)}
						/>
					</Field>
					<Field label={t("Paid in")} htmlFor="deal-asset">
						<select
							id="deal-asset"
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
				</div>
				<ol className={styles.milestones}>
					{rows.map((row, index) => (
						// Rows have no identity beyond their position while being typed.
						// biome-ignore lint/suspicious/noArrayIndexKey: see above
						<li key={index} className={styles.milestoneRow}>
							<Field
								label={t("Milestone {number}", { number: index + 1 })}
								htmlFor={`deal-label-${index}`}
							>
								<input
									id={`deal-label-${index}`}
									className={controlClass}
									maxLength={64}
									placeholder={t("Design delivered")}
									value={row.label}
									onChange={(e) => update(index, { label: e.target.value })}
								/>
							</Field>
							<Field
								label={t("Amount ({currency})", { currency })}
								htmlFor={`deal-amount-${index}`}
							>
								<input
									id={`deal-amount-${index}`}
									className={controlClass}
									inputMode="decimal"
									placeholder="0.00"
									value={row.amount}
									onChange={(e) => update(index, { amount: e.target.value })}
								/>
							</Field>
						</li>
					))}
				</ol>
				<div className={styles.actions}>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={rows.length >= MAX_MILESTONES}
						onClick={() => setRows([...rows, { label: "", amount: "" }])}
					>
						{t("Add a milestone")}
					</button>
					{rows.length > 1 && (
						<button
							type="button"
							className={buttonClass("secondary")}
							onClick={() => setRows(rows.slice(0, -1))}
						>
							{t("Remove the last")}
						</button>
					)}
					<span className={styles.muted}>
						{t("Total")} {formatMoney(total, currency)}
					</span>
				</div>
				<div className={styles.grid}>
					<Field
						label={t("Days to object")}
						htmlFor="deal-days"
						hint={t(
							"After the other side asks for a payout, you have this long to object; then it pays out automatically.",
						)}
					>
						<input
							id="deal-days"
							className={controlClass}
							inputMode="decimal"
							value={days}
							onChange={(e) => setDays(e.target.value)}
						/>
					</Field>
					<Field
						label={t("Arbiter (optional)")}
						htmlFor="deal-arbiter"
						hint={t(
							"Someone both sides trust to split what is left if you disagree. Without one, disputes aren't possible.",
						)}
					>
						<input
							id="deal-arbiter"
							className={controlClass}
							placeholder={t("C… or G…")}
							spellCheck={false}
							value={arbiter}
							onChange={(e) => setArbiter(e.target.value)}
						/>
					</Field>
				</div>
				<label className={styles.upload}>
					<span className={styles.label}>{t("Agreement")}</span>
					<input type="file" onChange={pickDocument} />
					<span>
						{document
							? `${document.name} · fingerprint ${document.hash.slice(0, 16)}…`
							: t("Only the file's fingerprint is recorded; the file itself stays with you.")}
					</span>
				</label>
				{error && (
					<p className={styles.error} role="alert">
						{t(error)}
					</p>
				)}
				<button type="submit" className={buttonClass()} disabled={busy}>
					{t("Propose the deal")}
				</button>
			</form>
		</Card>
	);
}
