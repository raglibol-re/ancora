import { balanceEffect, type OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatDateTime, formatMoney, formatSignedMoney } from "../../ui/format.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ActivityList.module.css";
import { describeActivity } from "./describeActivity.ts";

export function ActivityList({ account }: { account: OrgAccount }) {
	const { personName } = useWorkspace();
	const entries = account.activity.slice(0, 12);

	return (
		<Card title="Activity">
			{entries.length === 0 ? (
				<p className={styles.empty}>
					Nothing yet. Deposits, payments and changes will appear here.
				</p>
			) : (
				<ul className={styles.list}>
					{entries.map((entry) => {
						const effect = balanceEffect(entry);
						const amount = "amount" in entry ? entry.amount : 0;
						return (
							<li key={entry.id} className={styles.row}>
								<span className={styles.text}>
									<span>{describeActivity(account, entry, personName)}</span>
									<span className={styles.meta}>
										{formatDateTime(entry.at)}
										{entry.actorId && ` · ${personName(entry.actorId)}`}
									</span>
									{"txHash" in entry && entry.txHash && (
										<ExplorerLink target={entry.txHash}>View transaction</ExplorerLink>
									)}
								</span>
								{amount !== 0 && (
									<span className={effect > 0 ? styles.positive : styles.amount}>
										{effect === 0
											? formatMoney(amount, account.currency)
											: formatSignedMoney(effect, account.currency)}
									</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</Card>
	);
}
