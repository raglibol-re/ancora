import { availableBalance, type OrgAccount } from "../../domain/account.ts";
import type { Cents } from "../../domain/money.ts";
import { evaluatePayment } from "../../domain/rules/policy.ts";
import { formatMoney } from "../../ui/format.ts";
import { describeEvaluation } from "../requests/describe.ts";
import styles from "./RulePreview.module.css";

type RulePreviewProps = {
	account: OrgAccount;
	amount: Cents | null;
	recipientIsNew: boolean;
};

/** Live answer to "what happens if I send this?", straight from the rules engine. */
export function RulePreview({ account, amount, recipientIsNew }: RulePreviewProps) {
	if (amount === null) {
		return (
			<p className={styles.preview} aria-live="polite">
				Enter an amount to see what your rules require.
			</p>
		);
	}
	const evaluation = evaluatePayment(account.org.policy, { amount, recipientIsNew });
	const short = amount > availableBalance(account);

	return (
		<div className={styles.preview} aria-live="polite">
			<p className={styles.rule}>{describeEvaluation(account.org, evaluation)}</p>
			{recipientIsNew && account.org.policy.newRecipientApprovals.length > 0 && (
				<p className={styles.detail}>
					Includes the extra check for a first payment to a new recipient.
				</p>
			)}
			{short && (
				<p className={styles.warning}>
					Only {formatMoney(availableBalance(account))} is available on the main account.
				</p>
			)}
		</div>
	);
}
