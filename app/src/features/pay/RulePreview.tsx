import { availableBalance, currencyOf, isForeign, type OrgAccount } from "../../domain/account.ts";
import type { Cents } from "../../domain/money.ts";
import { evaluatePayment } from "../../domain/rules/policy.ts";
import { formatMoney } from "../../ui/format.ts";
import { describeEvaluation } from "../requests/describe.ts";
import styles from "./RulePreview.module.css";

type RulePreviewProps = {
	account: OrgAccount;
	token: string;
	amount: Cents | null;
	recipientIsNew: boolean;
};

/** Live answer to "what happens if I send this?", straight from the rules engine. */
export function RulePreview({ account, token, amount, recipientIsNew }: RulePreviewProps) {
	if (amount === null) {
		return (
			<p className={styles.preview} aria-live="polite">
				Enter an amount to see what your rules require.
			</p>
		);
	}
	const foreignCurrency = isForeign(account.org, token);
	const evaluation = evaluatePayment(account.org.policy, {
		amount,
		recipientIsNew,
		foreignCurrency,
	});
	const available = availableBalance(account, token);
	const currency = currencyOf(account, token);

	return (
		<div className={styles.preview} aria-live="polite">
			<p className={styles.rule}>{describeEvaluation(account.org, evaluation)}</p>
			{foreignCurrency && (
				<p className={styles.detail}>
					The rules are in {account.org.baseCurrency}; a payment in {currency} takes the strictest
					tier and the seal until a live exchange rate is connected.
				</p>
			)}
			{recipientIsNew && account.org.policy.newRecipientApprovals.length > 0 && (
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
