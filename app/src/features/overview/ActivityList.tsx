import type { ComponentType } from "react";
import {
	type ActivityEntry,
	balanceEffect,
	currencyOf,
	type OrgAccount,
} from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatDateTime, formatMoney, formatSignedMoney } from "../../ui/format.ts";
import { ReceiveIcon, ReserveIcon, RulesIcon, SendIcon, SettingsIcon } from "../../ui/icons.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ActivityList.module.css";
import { describeActivity } from "./describeActivity.ts";
import { downloadStatement } from "./downloadStatement.ts";

const ICONS: Record<ActivityEntry["kind"], ComponentType> = {
	"payment-out": SendIcon,
	deposit: ReceiveIcon,
	"reserve-in": ReserveIcon,
	"reserve-out": ReserveIcon,
	earnings: ReserveIcon,
	governance: RulesIcon,
	logo: SettingsIcon,
};

/** "Today", "Yesterday", or the date, so a day's movements read as one block. */
function dayLabel(at: number, now: number): string {
	const day = (t: number) => new Date(t).toDateString();
	if (day(at) === day(now)) return "Today";
	if (day(at) === day(now - 86_400_000)) return "Yesterday";
	return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function ActivityList({ account }: { account: OrgAccount }) {
	const { personName } = useWorkspace();
	const entries = account.activity.slice(0, 12);
	const now = Date.now();

	return (
		<Card
			title="Activity"
			action={
				account.activity.length > 0 && (
					<button
						type="button"
						className={styles.export}
						onClick={() => downloadStatement(account, personName)}
					>
						Download statement (CSV)
					</button>
				)
			}
		>
			{entries.length === 0 ? (
				<p className={styles.empty}>
					Nothing yet. Deposits, payments and changes will appear here.
				</p>
			) : (
				<ul className={styles.list}>
					{entries.map((entry, index) => {
						const effect = balanceEffect(entry);
						const amount = "amount" in entry ? entry.amount : 0;
						const currency =
							"token" in entry ? currencyOf(account, entry.token) : account.org.baseCurrency;
						const Icon = ICONS[entry.kind];
						const previous = entries[index - 1];
						const label = dayLabel(entry.at, now);
						const newDay = !previous || dayLabel(previous.at, now) !== label;
						return (
							<li key={entry.id} className={styles.row}>
								{newDay && <span className={styles.day}>{label}</span>}
								<span className={styles.icon} aria-hidden="true">
									<Icon />
								</span>
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
											? formatMoney(amount, currency)
											: formatSignedMoney(effect, currency)}
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
