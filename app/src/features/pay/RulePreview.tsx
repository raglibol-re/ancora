import { availableBalance, currencyOf, isForeign, type OrgAccount } from "../../domain/account.ts";
import { checkBudget, describePeriod } from "../../domain/budgets.ts";
import type { Cents } from "../../domain/money.ts";
import { evaluateProposal } from "../../domain/rules/controls.ts";
import { periodLabel, remainingAllowance } from "../../domain/rules/limits.ts";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { describeEvaluation } from "../requests/describe.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./RulePreview.module.css";

type RulePreviewProps = {
	account: OrgAccount;
	token: string;
	amount: Cents | null;
	recipientIsNew: boolean;
	/** Every recipient's address as typed or chosen (one, or each line of a batch). */
	recipients: readonly string[];
	category: string | null;
};

/** Live answer to "what happens if I send this?", straight from the rules engine. */
export function RulePreview({
	account,
	token,
	amount,
	recipientIsNew,
	recipients,
	category,
}: RulePreviewProps) {
	const t = useT();
	const { me } = useWorkspace();
	if (amount === null) {
		return (
			<p className={styles.preview} aria-live="polite">
				{t("Enter an amount to see what your rules require.")}
			</p>
		);
	}
	const now = Date.now();
	const foreignCurrency = isForeign(account.org, token);
	const member = account.org.members.find((m) => m.personId === me.id);
	const budget = checkBudget(account, category, amount, foreignCurrency, now);
	const overBudget = budget.kind === "over";
	const proposal = evaluateProposal(
		account.org,
		{ requesterId: me.id, token, amount, category, recipients, recipientIsNew, overBudget },
		now,
	);
	const available = availableBalance(account, token);
	const currency = currencyOf(account, token);
	if (proposal.kind === "refused") {
		return (
			<div className={styles.preview} aria-live="polite">
				<p className={styles.warning}>
					{t(
						"Your organization only pays recipients on its allowlist, and this one isn't on it. Ask for them to be added on the Rules page.",
					)}
				</p>
			</div>
		);
	}
	const { evaluation, use, amountInTiers, outsideAllowlist } = proposal;
	const withinLimit = use.kind !== "none";
	const allowance = use.kind === "allowance" ? member?.allowances?.[use.index] : undefined;

	return (
		<div className={styles.preview} aria-live="polite">
			{budget.kind === "refused" ? (
				<p className={styles.warning}>
					{t("Beyond what is left of the #")}
					{budget.line.category} {t("budget this")} {describePeriod(budget.line.periodSeconds)} (
					{formatMoney(Math.max(0, budget.line.remaining), currency)}
					{t("). It is a hard budget, so this payment won't be accepted.")}
				</p>
			) : (
				<p className={styles.rule}>{describeEvaluation(account.org, evaluation)}</p>
			)}
			{(budget.kind === "within" || budget.kind === "over") && (
				<p className={styles.detail}>
					#{budget.line.category}: {formatMoney(Math.max(0, budget.line.remaining), currency)}{" "}
					{t("of")} {formatMoney(budget.line.amount, currency)} {t("left this")}{" "}
					{describePeriod(budget.line.periodSeconds)}
					{budget.kind === "over" ? t("; this payment goes beyond it.") : "."}
				</p>
			)}
			{allowance && (
				<p className={styles.detail}>
					{t("Inside your allowance")}
					{allowance.category ? ` for #${allowance.category}` : ""}:{" "}
					{formatMoney(remainingAllowance(allowance, now), currency)} {t("of")}{" "}
					{formatMoney(allowance.amount, currency)} {t("left this")}{" "}
					{periodLabel(allowance.periodSeconds)}.
				</p>
			)}
			{outsideAllowlist && (
				<p className={styles.detail}>
					{t("This recipient isn't on your allowlist, so the strictest approvals apply.")}
				</p>
			)}
			{member?.limit && !foreignCurrency && !allowance && (
				<p className={styles.detail}>
					{t("Your spending limit:")} {formatMoney(remainingAllowance(member.limit, now), currency)}{" "}
					{t("of")} {formatMoney(member.limit.amount, currency)} {t("left this")}{" "}
					{periodLabel(member.limit.periodSeconds)}
					{withinLimit ? "." : t("; this payment goes through the normal rules.")}
				</p>
			)}
			{foreignCurrency && !withinLimit && (
				<p className={styles.detail}>
					{amountInTiers !== null
						? `The rules are in ${account.org.baseCurrency}: at today's rate this is about ${formatMoney(amountInTiers, account.org.baseCurrency)}.`
						: `The rules are in ${account.org.baseCurrency}; without a current exchange rate a payment in ${currency} takes the strictest approvals and the seal.`}
				</p>
			)}
			{!withinLimit && recipientIsNew && account.org.policy.newRecipientApprovals.length > 0 && (
				<p className={styles.detail}>
					{t("Includes the extra check for a first payment to a new recipient.")}
				</p>
			)}
			{amount > available && (
				<p className={styles.warning}>
					{t("Only")} {formatMoney(available, currency)} {t("is available on the main account.")}
				</p>
			)}
		</div>
	);
}
