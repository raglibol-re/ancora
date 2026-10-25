import { type FormEvent, useState } from "react";
import { canManageTreasury, type OrgAccount } from "../../domain/account.ts";
import {
	type Budget,
	budgetReport,
	isCategory,
	toCategory,
	upsertBudget,
} from "../../domain/budgets.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass } from "../../ui/Field.tsx";
import { currencySymbol, formatMoney } from "../../ui/format.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./BudgetsCard.module.css";

/**
 * Monthly budgets per category against this month's executed payments. Budgets inform; the
 * approval rules enforce. Whoever may manage the treasury edits them.
 */
export function BudgetsCard({ account }: { account: OrgAccount }) {
	const { me, dataSource } = useWorkspace();
	const { run, busy } = useCommand();
	const report = budgetReport(account, Date.now());
	const mayEdit = canManageTreasury(account.org, me.id);
	const currency = account.org.baseCurrency;
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [error, setError] = useState<string | null>(null);

	const save = (budgets: Budget[]) =>
		run(() => dataSource.saveBudgets(account.org.id, me.id, budgets), {
			success: "Budgets saved.",
		});

	const add = async (event: FormEvent) => {
		event.preventDefault();
		const category = toCategory(name);
		const cents = parseAmountInput(amount);
		if (!isCategory(category)) {
			setError("Name the category with letters or digits, like equipment or travel.");
			return;
		}
		if (cents === null || cents <= 0) {
			setError("Enter a monthly amount like 500.");
			return;
		}
		setError(null);
		const result = await save(upsertBudget(account.budgets, { category, amount: cents }));
		if (result?.ok) {
			setName("");
			setAmount("");
		}
	};

	return (
		<Card title="Budgets" action={<span className={styles.month}>{report.monthLabel}</span>}>
			<p className={styles.muted}>
				Plans per category and month, in {currency}. A payment counts when its reference carries the
				category as a tag, like “Oars #equipment”. Budgets inform; the rules enforce.
			</p>
			{report.lines.length === 0 ? (
				<p className={styles.muted}>No budgets yet.</p>
			) : (
				<ul className={styles.list}>
					{report.lines.map((line) => (
						<li key={line.category} className={styles.line}>
							<div className={styles.head}>
								<span className={styles.category}>#{line.category}</span>
								<span>
									{formatMoney(line.spent, currency)} of {formatMoney(line.amount, currency)}
								</span>
							</div>
							<progress
								className={styles.bar}
								max={line.amount}
								value={Math.min(line.spent, line.amount)}
								aria-label={`${line.category}: ${formatMoney(line.spent, currency)} of ${formatMoney(line.amount, currency)}`}
							/>
							<div className={styles.foot}>
								<span className={line.remaining < 0 ? styles.over : styles.muted}>
									{line.remaining >= 0
										? `${formatMoney(line.remaining, currency)} left this month`
										: `${formatMoney(-line.remaining, currency)} over budget`}
								</span>
								{mayEdit && (
									<button
										type="button"
										className={styles.linkButton}
										disabled={busy}
										onClick={() => save(upsertBudget(account.budgets, { ...line, amount: 0 }))}
									>
										Remove
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
			{(report.uncategorized > 0 || report.otherCurrency > 0) && (
				<p className={styles.muted}>
					{report.uncategorized > 0 &&
						`${formatMoney(report.uncategorized, currency)} went out this month without a budgeted category. `}
					{report.otherCurrency > 0 &&
						`${report.otherCurrency} payment${report.otherCurrency === 1 ? "" : "s"} in another currency ${report.otherCurrency === 1 ? "isn't" : "aren't"} counted.`}
				</p>
			)}
			{mayEdit && (
				<form className={styles.form} onSubmit={add}>
					<label className={styles.field}>
						Category
						<input
							className={controlClass}
							value={name}
							placeholder="equipment"
							autoComplete="off"
							onChange={(e) => setName(e.target.value)}
						/>
					</label>
					<label className={styles.field}>
						Per month ({currencySymbol(currency)})
						<input
							className={controlClass}
							inputMode="decimal"
							value={amount}
							placeholder="500"
							onChange={(e) => setAmount(e.target.value)}
						/>
					</label>
					<button type="submit" className={buttonClass("secondary")} disabled={busy}>
						{account.budgets.some((b) => b.category === toCategory(name))
							? "Update budget"
							: "Add budget"}
					</button>
					{error && (
						<p className={styles.error} role="alert">
							{error}
						</p>
					)}
				</form>
			)}
		</Card>
	);
}
