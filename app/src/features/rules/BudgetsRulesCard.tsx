import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import {
	BUDGET_PERIODS,
	budgetLines,
	isCategory,
	toCategory,
	upsertBudget,
} from "../../domain/budgets.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { BudgetMeter } from "../../ui/BudgetMeter.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import styles from "./BudgetsRulesCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * Budgets are rules: one envelope per category and period in the home currency, enforced by the
 * contract. Changing them is a rule change like any other (direct in the setup phase, otherwise
 * a request), and the rules document hash covers them.
 */
export function BudgetsRulesCard({ account }: { account: OrgAccount }) {
	const { propose, busy } = useProposeChange(account);
	const { policy, baseCurrency } = account.org;
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [period, setPeriod] = useState(BUDGET_PERIODS[1]?.seconds ?? 30 * 86_400);
	const [mode, setMode] = useState<"soft" | "hard">("soft");
	const [error, setError] = useState<string | null>(null);

	const save = (budgets: typeof policy.budgets) =>
		propose({ type: "updatePolicy", policy: { ...policy, budgets } });

	const add = async (event: FormEvent) => {
		event.preventDefault();
		const category = toCategory(name);
		const cents = parseAmountInput(amount);
		if (!isCategory(category)) {
			setError("Name the category with letters or digits, like equipment or travel.");
			return;
		}
		if (cents === null || cents <= 0) {
			setError("Enter an amount above zero.");
			return;
		}
		setError(null);
		const result = await save(
			upsertBudget(policy.budgets, {
				category,
				amount: cents,
				periodSeconds: period,
				hard: mode === "hard",
			}),
		);
		if (result?.ok) {
			setName("");
			setAmount("");
		}
	};

	return (
		<Card title="Budgets">
			<p className={styles.muted}>
				Envelopes per category and period, in {baseCurrency}. A payment tagged with the category
				counts against it. Beyond what is left, a <strong>soft</strong> budget sends the payment
				through the strictest tier and flags it; a <strong>hard</strong> budget refuses it. Enforced
				by the organization's contract.
			</p>
			<BudgetMeter
				lines={budgetLines(account, Date.now())}
				currency={baseCurrency}
				busy={busy}
				onRemove={(category) =>
					save(policy.budgets.filter((budget) => budget.category !== category))
				}
			/>
			<form className={styles.form} onSubmit={add}>
				<div className={styles.row}>
					<Field label="Category" htmlFor="budget-category">
						<input
							id="budget-category"
							className={controlClass}
							value={name}
							placeholder="equipment"
							autoComplete="off"
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
					<Field label={`Amount (${baseCurrency})`} htmlFor="budget-amount">
						<input
							id="budget-amount"
							className={controlClass}
							inputMode="decimal"
							value={amount}
							placeholder="500"
							onChange={(e) => setAmount(e.target.value)}
						/>
					</Field>
					<Field label="Per" htmlFor="budget-period">
						<select
							id="budget-period"
							className={controlClass}
							value={period}
							onChange={(e) => setPeriod(Number(e.target.value))}
						>
							{BUDGET_PERIODS.map((p) => (
								<option key={p.seconds} value={p.seconds}>
									{p.label}
								</option>
							))}
						</select>
					</Field>
				</div>
				<Segmented<"soft" | "hard">
					label="Beyond the budget"
					value={mode}
					onChange={setMode}
					options={[
						{ value: "soft", label: "Strictest tier" },
						{ value: "hard", label: "Refuse" },
					]}
				/>
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<div>
					<button type="submit" className={buttonClass("secondary")} disabled={busy}>
						{policy.budgets.some((b) => b.category === toCategory(name))
							? "Update budget"
							: "Add budget"}
					</button>
				</div>
			</form>
		</Card>
	);
}
