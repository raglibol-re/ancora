import { currencyOf, type OrgAccount, recipientLabel } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./StandingOrdersCard.module.css";

export const REPEAT_OPTIONS = [
	{ value: "week", label: "every week", title: "Every week", seconds: 7 * 86_400 },
	{ value: "fortnight", label: "every two weeks", title: "Every two weeks", seconds: 14 * 86_400 },
	{ value: "month", label: "every month", title: "Every month", seconds: 30 * 86_400 },
] as const;

export type RepeatValue = (typeof REPEAT_OPTIONS)[number]["value"];

/** "every month" for a stored interval; the nearest preset, or the plain number of days. */
function intervalLabel(seconds: number): string {
	const preset = REPEAT_OPTIONS.find((option) => option.seconds === seconds);
	if (preset) return preset.label;
	const days = Math.round(seconds / 86_400);
	return days >= 1 ? `every ${days} days` : `every ${Math.round(seconds / 3_600)} hours`;
}

/**
 * The organization's repeating payments. A due order runs when a member presses "Run now"
 * (the contract lets anyone run it); the owner or the top role can stop it.
 */
export function StandingOrdersCard({ account }: { account: OrgAccount }) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const orders = account.standingOrders;
	if (orders === null) {
		return (
			<Card title="Standing orders">
				<p className={styles.muted}>
					This organization was created before standing orders existed; organizations created from
					today can repeat a payment weekly, fortnightly or monthly.
				</p>
			</Card>
		);
	}
	const active = orders.filter((order) => order.active);
	const now = Date.now();
	return (
		<Card title="Standing orders">
			{active.length === 0 ? (
				<p className={styles.muted}>
					None yet. Choose "Repeat" on the form above to pay someone weekly, fortnightly or monthly;
					every run follows the organization's rules like a one-off payment.
				</p>
			) : (
				<ul className={styles.list}>
					{active.map((order) => {
						const due = order.nextAt <= now;
						const currency = currencyOf(account, order.token);
						return (
							<li key={order.id} className={styles.row}>
								<span className={styles.text}>
									<span>
										{formatMoney(order.amount, currency)} to {recipientLabel(account, order.to)}{" "}
										{intervalLabel(order.intervalSeconds)}
									</span>
									<span className={styles.meta}>
										{due ? "Due now" : `Next on ${formatDateTime(order.nextAt)}`} · set by{" "}
										{personName(order.by)}
										{order.runs > 0 && ` · ${order.runs} ${order.runs === 1 ? "run" : "runs"}`}
										{order.memo && ` · ${order.memo}`}
									</span>
								</span>
								<span className={styles.actions}>
									{due && (
										<button
											type="button"
											className={buttonClass("secondary")}
											disabled={busy}
											onClick={() =>
												run(() => dataSource.runStandingOrder(account.org.id, order.id), {
													success: "Standing order run: the payment follows the rules from here.",
												})
											}
										>
											Run now
										</button>
									)}
									<button
										type="button"
										className={buttonClass("secondary")}
										disabled={busy}
										onClick={() =>
											run(() => dataSource.cancelStandingOrder(account.org.id, me.id, order.id), {
												signature: {
													kind: "passkey",
													title: `Stop the standing order to ${recipientLabel(account, order.to)}`,
												},
												success: "Standing order stopped.",
											})
										}
									>
										Stop
									</button>
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</Card>
	);
}
