import { availableBalance, currencyOf, isForeign, type OrgAccount } from "../../domain/account.ts";
import { checkBudget, describePeriod } from "../../domain/budgets.ts";
import type { Cents } from "../../domain/money.ts";
import { fitsLimit, periodLabel, remainingAllowance } from "../../domain/rules/limits.ts";
import { evaluatePayment, limitEvaluation } from "../../domain/rules/policy.ts";
import { formatMoney } from "../../ui/format.ts";
import { describeEvaluation } from "../requests/describe.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./RulePreview.module.css";

type RulePreviewProps = {
	account: OrgAccount;
	token: string;
	amount: Cents | null;
	recipientIsNew: boolean;
	category: string | null;
};

/** Live answer to "what happens if I send this?", straight from the rules engine. */
export function RulePreview({
	account,
	token,
	amount,
	recipientIsNew,
	category,
}: RulePreviewProps) {
	const { me } = useWorkspace();
	if (amount === null) {
		return (
			<p className={styles.preview} aria-live="polite">
				Enter an amount to see what your rules require.
			</p>
		);
	}
	const now = Date.now();
	const foreignCurrency = isForeign(account.org, token);
	const member = account.org.members.find((m) => m.personId === me.id);
	const budget = checkBudget(account, category, amount, foreignCurrency, now);
	const overBudget = budget.kind === "over";
	const withinLimit = !foreignCurrency && !overBudget && fitsLimit(member, amount, now);
	const evaluation = withinLimit
		? limitEvaluation()
		: evaluatePayment(account.org.policy, {
				amount,
				recipientIsNew,
				foreignCurrency,
				overBudget,
			});
	const available = availableBalance(account, token);
	const currency = currencyOf(account, token);

	return (
		<div className={styles.preview} aria-live="polite">
			{budget.kind === "refused" ? (
				<p className={styles.warning}>
					Beyond what is left of the #{budget.line.category} budget this{" "}
					{describePeriod(budget.line.periodSeconds)} (
					{formatMoney(Math.max(0, budget.line.remaining), currency)}). It is a hard budget, so this
					payment won't be accepted.
				</p>
			) : (
				<p className={styles.rule}>{describeEvaluation(account.org, evaluation)}</p>
			)}
			{(budget.kind === "within" || budget.kind === "over") && (
				<p className={styles.detail}>
					#{budget.line.category}: {formatMoney(Math.max(0, budget.line.remaining), currency)} of{" "}
					{formatMoney(budget.line.amount, currency)} left this{" "}
					{describePeriod(budget.line.periodSeconds)}
					{budget.kind === "over" ? "; this payment goes beyond it." : "."}
				</p>
			)}
			{member?.limit && !foreignCurrency && (
				<p className={styles.detail}>
					Your spending limit: {formatMoney(remainingAllowance(member.limit, now), currency)} of{" "}
					{formatMoney(member.limit.amount, currency)} left this{" "}
					{periodLabel(member.limit.periodSeconds)}
					{withinLimit ? "." : "; this payment goes through the normal rules."}
				</p>
			)}
			{foreignCurrency && (
				<p className={styles.detail}>
					The rules are in {account.org.baseCurrency}; a payment in {currency} takes the strictest
					tier and the seal until a live exchange rate is connected.
				</p>
			)}
			{!withinLimit && recipientIsNew && account.org.policy.newRecipientApprovals.length > 0 && (
				<p className={styles.detail}>
					Includes the extra check for a first payment to a new recipient.
				</p>
			)}
			{amount > available && (
				<p className={styles.warning}>
					Only {formatMoney(available, currency)} is available on the main account.
				</p>
			)}
		</div>
	);
}
