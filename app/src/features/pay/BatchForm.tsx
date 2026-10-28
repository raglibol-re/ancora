import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import {
	availableBalance,
	isNewRecipient,
	type OrgAccount,
	primaryToken,
} from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { MAX_BATCH_LINES } from "../../domain/rules/requests.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./BatchForm.module.css";
import { RulePreview } from "./RulePreview.tsx";

type Line = { to: string; amount: string; note: string };
const emptyLine = (): Line => ({ to: "", amount: "", note: "" });

/**
 * Several payments in one asset as one request (payroll, reimbursements): the rules judge the
 * total, it is approved once, and every line is paid out together, or none.
 */
export function BatchForm({ account }: { account: OrgAccount }) {
	const { dataSource, me } = useWorkspace();
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
			setError("Add at least one payment.");
			return;
		}
		const broken = filled.findIndex((line) => {
			const cents = parseAmountInput(line.amount);
			return !line.to.trim() || cents === null || cents <= 0;
		});
		if (broken >= 0) {
			setError(`Line ${broken + 1} needs a recipient and an amount above zero.`);
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
					title: `Send ${formatMoney(total, currency)} to ${filled.length} recipients`,
				},
			},
		);
		if (result?.ok) navigate(`/app/approvals/${result.value}`);
	};

	return (
		<Card>
			<form className={styles.form} onSubmit={submit} noValidate>
				{account.org.assets.length > 1 && (
					<Field label="Pay with" htmlFor="batch-asset">
						<select
							id="batch-asset"
							className={controlClass}
							value={token}
							onChange={(e) => setToken(e.target.value)}
						>
							{account.org.assets.map((a) => (
								<option key={a.token} value={a.token}>
									{a.symbol} ({a.currency}) ·{" "}
									{formatMoney(availableBalance(account, a.token), a.currency)} available
								</option>
							))}
						</select>
					</Field>
				)}
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
									label={`Recipient ${index + 1}`}
									htmlFor={`batch-to-${index}`}
									hint={known ? known.name : undefined}
								>
									<input
										id={`batch-to-${index}`}
										className={controlClass}
										list="batch-payees"
										autoComplete="off"
										placeholder={
											account.onchain ? "G… or C… or a saved name" : "IBAN or a saved name"
										}
										value={line.to}
										onChange={(e) => update(index, { to: e.target.value })}
									/>
								</Field>
								<Field label={`Amount (${currency})`} htmlFor={`batch-amount-${index}`}>
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
								<Field label="Reference" htmlFor={`batch-note-${index}`}>
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
									aria-label={`Remove line ${index + 1}`}
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
					Add a line
				</button>
				<p className={styles.total}>
					Total {formatMoney(total, currency)} to {lines.filter((l) => l.to.trim()).length}{" "}
					recipients
				</p>
				<RulePreview
					account={account}
					token={token}
					amount={total > 0 ? total : null}
					recipientIsNew={anyNew}
					category={category || null}
				/>
				{account.org.policy.budgets.length > 0 && (
					<Field label="Budget category" htmlFor="batch-category">
						<select
							id="batch-category"
							className={controlClass}
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						>
							<option value="">None</option>
							{account.org.policy.budgets.map((budget) => (
								<option key={budget.category} value={budget.category}>
									#{budget.category}
								</option>
							))}
						</select>
					</Field>
				)}
				<Field
					label="Reference for the whole batch"
					htmlFor="batch-note"
					hint="Shown to approvers."
				>
					<input
						id="batch-note"
						className={controlClass}
						placeholder="Coaches, October"
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
				</Field>
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<button type="submit" className={buttonClass()} disabled={busy}>
					Request the batch
				</button>
			</form>
		</Card>
	);
}
