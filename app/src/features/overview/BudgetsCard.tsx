import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { budgetLines } from "../../domain/budgets.ts";
import { BudgetMeter } from "../../ui/BudgetMeter.tsx";
import { Card } from "../../ui/Card.tsx";
import styles from "./OverviewPage.module.css";

/** This period's budgets against what the contract booked; edited on the Rules page. */
export function BudgetsCard({ account }: { account: OrgAccount }) {
	const lines = budgetLines(account, Date.now());
	if (lines.length === 0) return null;
	return (
		<Card
			title="Budgets"
			action={
				<Link to="/app/rules" className={styles.sub}>
					Edit in Rules
				</Link>
			}
		>
			<BudgetMeter lines={lines} currency={account.org.baseCurrency} />
		</Card>
	);
}
