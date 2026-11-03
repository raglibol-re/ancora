import type { OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./AccountNumberCard.module.css";

/**
 * How money reaches the account: the smart account address on Stellar (real on testnet), and the
 * EUR account number from the licensed ramp partner (simulated; on testnet the SEP-24 anchor
 * flow in the asset sheet is the real route).
 */
export function AccountNumberCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const number = account.accountNumber;
	return (
		<div id="account-number">
			{account.onchain && (
				<Card title={t("Account on Stellar")}>
					<dl className={styles.details}>
						<dt>{t("Address")}</dt>
						<dd className={styles.iban}>{account.onchain.contractId}</dd>
					</dl>
					<p className={styles.note}>
						{t(
							'The organization\'s own contract. Any of the stablecoins it accepts (see Rules) sent to this address arrives on its balances. A plain Stellar payment can\'t reach a contract address: use "Add money" above to send from your wallet, or a wallet that can pay contracts (Freighter). Bank deposits and withdrawals go through a Stellar anchor: tap an account above, then "Add" or "To a bank account".',
						)}
					</p>
					<ExplorerLink target={account.onchain.contractId} />
				</Card>
			)}
			{!account.onchain && (
				<Card title={t("Account number")} action={<SimulatedTag />}>
					{number ? (
						<>
							<dl className={styles.details}>
								<dt>{t("IBAN")}</dt>
								<dd className={styles.iban}>{number.iban}</dd>
								<dt>{t("BIC")}</dt>
								<dd>{number.bic}</dd>
								<dt>{t("Account holder")}</dt>
								<dd>{number.holder}</dd>
							</dl>
							<p className={styles.note}>
								{t(
									"SEPA transfers to this IBAN arrive in euros on your main account. Provided by a licensed payment partner.",
								)}
							</p>
						</>
					) : (
						<p className={styles.note}>
							{t(
								"No account number yet. Euro account numbers come from a licensed payment partner after a short business verification.",
							)}
						</p>
					)}
				</Card>
			)}
		</div>
	);
}
