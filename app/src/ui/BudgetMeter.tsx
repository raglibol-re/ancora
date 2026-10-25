import type { BudgetLine } from "../domain/budgets.ts";
import { describePeriod } from "../domain/budgets.ts";
import type { Currency } from "../domain/money.ts";
import styles from "./BudgetMeter.module.css";
import { formatMoney } from "./format.ts";

type BudgetMeterProps = {
	lines: readonly BudgetLine[];
	currency: Currency;
	/** Renders a remove action per line when given (the rules editor). */
	onRemove?: (category: string) => void;
	busy?: boolean;
};

/** Budgets as meters: spent of amount per period, what's left, hard or soft. */
export function BudgetMeter({ lines, currency, onRemove, busy }: BudgetMeterProps) {
	if (lines.length === 0) return <p className={styles.muted}>No budgets yet.</p>;
	return (
		<ul className={styles.list}>
			{lines.map((line) => {
				const over = line.remaining < 0;
				return (
					<li key={line.category} className={styles.line}>
						<div className={styles.head}>
							<span className={styles.category}>
								#{line.category}
								<span className={styles.mode}>{line.hard ? "hard" : "soft"}</span>
							</span>
							<span>
								{formatMoney(line.spent, currency)} of {formatMoney(line.amount, currency)} per{" "}
								{describePeriod(line.periodSeconds)}
							</span>
						</div>
						<progress
							className={over ? `${styles.bar} ${styles.barOver}` : styles.bar}
							max={line.amount}
							value={Math.min(line.spent, line.amount)}
							aria-label={`${line.category}: ${formatMoney(line.spent, currency)} of ${formatMoney(line.amount, currency)}`}
						/>
						<div className={styles.foot}>
							<span className={over ? styles.over : styles.muted}>
								{over
									? `${formatMoney(-line.remaining, currency)} over budget${line.hard ? "" : "; further payments take the strictest tier"}`
									: `${formatMoney(line.remaining, currency)} left this period`}
							</span>
							{onRemove && (
								<button
									type="button"
									className={styles.linkButton}
									disabled={busy}
									onClick={() => onRemove(line.category)}
								>
									Remove
								</button>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
