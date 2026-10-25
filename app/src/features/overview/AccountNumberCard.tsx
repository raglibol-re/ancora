import type { OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import styles from "./AccountNumberCard.module.css";

/** EUR account number from the licensed ramp partner; deposits arrive as EURC (task 10). */
export function AccountNumberCard({ account }: { account: OrgAccount }) {
	const number = account.accountNumber;
	return (
		<div id="account-number">
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
						No account number yet. Euro account numbers come from a licensed payment partner after a
						short business verification.
					</p>
				)}
			</Card>
		</div>
	);
}
