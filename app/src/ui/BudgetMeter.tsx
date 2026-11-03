import type { BudgetLine } from "../domain/budgets.ts";
import { describePeriod } from "../domain/budgets.ts";
import type { Currency } from "../domain/money.ts";
import styles from "./BudgetMeter.module.css";
import { formatMoney } from "./format.ts";
import { useT } from "./useLanguage.ts";

type BudgetMeterProps = {
	lines: readonly BudgetLine[];
	currency: Currency;
	/** Renders a remove action per line when given (the rules editor). */
	onRemove?: (category: string) => void;
	busy?: boolean;
};

/** Budgets as meters: spent of amount per period, what's left, hard or soft. */
export function BudgetMeter({ lines, currency, onRemove, busy }: BudgetMeterProps) {
	const t = useT();
	if (lines.length === 0) return <p className={styles.muted}>{t("No budgets yet.")}</p>;
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
							aria-label={`${line.category}: ${t("{spent} of {total}", { spent: formatMoney(line.spent, currency), total: formatMoney(line.amount, currency) })}`}
						/>
						<div className={styles.foot}>
							<span className={over ? styles.over : styles.muted}>
								{over
									? line.hard
										? t("{amount} over budget", { amount: formatMoney(-line.remaining, currency) })
										: t("{amount} over budget; further payments take the strictest tier", {
												amount: formatMoney(-line.remaining, currency),
											})
									: t("{amount} left this period", {
											amount: formatMoney(line.remaining, currency),
										})}
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
