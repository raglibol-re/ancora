import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import {
	availableBalance,
	isNewRecipient,
	type OrgAccount,
	primaryToken,
} from "../../domain/account.ts";
import type { BatchLineInput } from "../../domain/batchImport.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { fitsPrivately } from "../../domain/privateNote.ts";
import { MAX_BATCH_LINES } from "../../domain/rules/requests.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./BatchForm.module.css";
import { BatchImport } from "./BatchImport.tsx";
import { RulePreview } from "./RulePreview.tsx";
import { usePrivateEpoch } from "./usePrivateEpoch.ts";

type Line = BatchLineInput;
const emptyLine = (): Line => ({ to: "", amount: "", note: "" });

/**
 * Several payments in one asset as one request (payroll, reimbursements): the rules judge the
 * total, it is approved once, and every line is paid out together, or none.
 */
export function BatchForm({ account }: { account: OrgAccount }) {
	const t = useT();
	const { dataSource, me } = useWorkspace();
	const privateEpoch = usePrivateEpoch(account.org.id);
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const [token, setToken] = useState(primaryToken(account));
	const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
	const [note, setNote] = useState("");
	const [category, setCategory] = useState("");
	const [error, setError] = useState<string | null>(null);
	const asset = account.org.assets.find((a) => a.token === token);
	const currency = asset?.currency ?? account.org.baseCurrency;
	const payeeOf = (to: string) => account.payees.find((p) => p.account === to.trim());
	const amounts = lines.map((line) => parseAmountInput(line.amount));
	const total = amounts.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
	const anyNew = lines.some((line) => {
		const payee = payeeOf(line.to);
		return line.to.trim() !== "" && (!payee || isNewRecipient(account, payee.id));
	});

	const update = (index: number, change: Partial<Line>) =>
		setLines(lines.map((line, i) => (i === index ? { ...line, ...change } : line)));

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const filled = lines.filter((line) => line.to.trim() || line.amount.trim());
		if (filled.length === 0) {
			setError(t("Add at least one payment."));
			return;
		}
		const broken = filled.findIndex((line) => {
			const cents = parseAmountInput(line.amount);
			return !line.to.trim() || cents === null || cents <= 0;
		});
		if (broken >= 0) {
			setError(t("Line {line} needs a recipient and an amount above zero.", { line: broken + 1 }));
			return;
		}
		setError(null);
		const result = await run(
			() =>
				dataSource.requestBatch(account.org.id, me.id, {
					token,
					note,
					category: category || null,
					lines: filled.map((line) => {
						const payee = payeeOf(line.to);
						return {
							payee: payee ? { id: payee.id } : { name: "", account: line.to.trim() },
							amount: parseAmountInput(line.amount) ?? 0,
							note: line.note,
						};
					}),
				}),
			{
				signature: {
					kind: "passkey",
					title: t("Send {amount} to {count} recipients", {
						amount: formatMoney(total, currency),
						count: filled.length,
					}),
				},
			},
		);
		if (result?.ok) navigate(`/app/approvals/${result.value}`);
	};

	return (
		<Card>
			<form className={styles.form} onSubmit={submit} noValidate>
				{account.org.assets.length > 1 && (
					<Field label={t("Pay with")} htmlFor="batch-asset">
						<select
							id="batch-asset"
							className={controlClass}
							value={token}
							onChange={(e) => setToken(e.target.value)}
						>
							{account.org.assets.map((a) => (
								<option key={a.token} value={a.token}>
									{a.symbol} ({a.currency}) ·{" "}
									{formatMoney(availableBalance(account, a.token), a.currency)} {t("available")}
								</option>
							))}
						</select>
					</Field>
				)}
				<BatchImport payees={account.payees} disabled={busy} onImport={setLines} />
				<datalist id="batch-payees">
					{account.payees.map((payee) => (
						<option key={payee.id} value={payee.account}>
							{payee.name}
						</option>
					))}
				</datalist>
				<ol className={styles.lines}>
					{lines.map((line, index) => {
						const known = payeeOf(line.to);
						return (
							// Lines have no identity beyond their position while being typed.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<li key={index} className={styles.line}>
								<Field
									label={t("Recipient {number}", { number: index + 1 })}
									htmlFor={`batch-to-${index}`}
									hint={known ? known.name : undefined}
								>
									<input
										id={`batch-to-${index}`}
										className={controlClass}
										list="batch-payees"
										autoComplete="off"
										placeholder={
											account.onchain ? t("G… or C… or a saved name") : t("IBAN or a saved name")
										}
										value={line.to}
										onChange={(e) => update(index, { to: e.target.value })}
									/>
								</Field>
								<Field
									label={t("Amount ({currency})", { currency })}
									htmlFor={`batch-amount-${index}`}
								>
									<input
										id={`batch-amount-${index}`}
										className={controlClass}
										inputMode="decimal"
										autoComplete="off"
										placeholder="0.00"
										value={line.amount}
										onChange={(e) => update(index, { amount: e.target.value })}
									/>
								</Field>
								<Field label={t("Reference")} htmlFor={`batch-note-${index}`}>
									<input
										id={`batch-note-${index}`}
										className={controlClass}
										autoComplete="off"
										value={line.note}
										onChange={(e) => update(index, { note: e.target.value })}
									/>
								</Field>
								<button
									type="button"
									className={styles.remove}
									aria-label={t("Remove line {number}", { number: index + 1 })}
									disabled={lines.length === 1}
									onClick={() => setLines(lines.filter((_, i) => i !== index))}
								>
									×
								</button>
							</li>
						);
					})}
				</ol>
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={lines.length >= MAX_BATCH_LINES}
					onClick={() => setLines([...lines, emptyLine()])}
				>
					{t("Add a line")}
				</button>
				<p className={styles.total}>
					{t("Total")} {formatMoney(total, currency)} {t("to")}{" "}
					{lines.filter((l) => l.to.trim()).length} {t("recipients")}
				</p>
				<RulePreview
					account={account}
					token={token}
					amount={total > 0 ? total : null}
					recipientIsNew={anyNew}
					recipients={lines
						.filter((line) => line.to.trim())
						.map((line) => payeeOf(line.to)?.account ?? line.to.trim())}
					category={category || null}
				/>
				{account.org.policy.budgets.length > 0 && (
					<Field label={t("Budget category")} htmlFor="batch-category">
						<select
							id="batch-category"
							className={controlClass}
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						>
							<option value="">{t("None")}</option>
							{account.org.policy.budgets.map((budget) => (
								<option key={budget.category} value={budget.category}>
									#{budget.category}
								</option>
							))}
						</select>
					</Field>
				)}
				<Field
					label={t("Reference for the whole batch")}
					htmlFor="batch-note"
					hint={
						privateEpoch > 0
							? t(
									"Private, like every line's reference: only your organization reads them (about 70 characters each).",
								)
							: t("Shown to approvers.")
					}
					error={
						privateEpoch > 0 && !fitsPrivately(note.trim(), privateEpoch)
							? t("Too long to keep private; shorten it.")
							: null
					}
				>
					<input
						id="batch-note"
						className={controlClass}
						placeholder={t("Coaches, October")}
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
				</Field>
				{error && (
					<p className={styles.error} role="alert">
						{t(error)}
					</p>
				)}
				<button type="submit" className={buttonClass()} disabled={busy}>
					{t("Request the batch")}
				</button>
			</form>
		</Card>
	);
}
