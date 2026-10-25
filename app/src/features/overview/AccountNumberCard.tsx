import type { OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import styles from "./AccountNumberCard.module.css";

/**
 * How money reaches the account: the smart account address on Stellar (real on testnet), and the
 * EUR account number from the licensed ramp partner (simulated until task 10).
 */
export function AccountNumberCard({ account }: { account: OrgAccount }) {
	const number = account.accountNumber;
	return (
		<div id="account-number">
			{account.onchain && (
				<Card title="Account on Stellar">
					<dl className={styles.details}>
						<dt>Address</dt>
						<dd className={styles.iban}>{account.onchain.contractId}</dd>
					</dl>
					<p className={styles.note}>
						A smart account secured by passkeys. USDC sent to this address arrives on your main
						account.
					</p>
					<ExplorerLink target={account.onchain.contractId} />
				</Card>
			)}
			{!account.onchain && (
				<Card title="Account number" action={<SimulatedTag />}>
					{number ? (
						<>
							<dl className={styles.details}>
								<dt>IBAN</dt>
								<dd className={styles.iban}>{number.iban}</dd>
								<dt>BIC</dt>
								<dd>{number.bic}</dd>
								<dt>Account holder</dt>
								<dd>{number.holder}</dd>
							</dl>
							<p className={styles.note}>
								SEPA transfers to this IBAN arrive in euros on your main account. Provided by a
								licensed payment partner.
							</p>
						</>
					) : (
						<p className={styles.note}>
							No account number yet. Euro account numbers come from a licensed payment partner after
							a short business verification.
						</p>
					)}
				</Card>
			)}
		</div>
	);
}
