import { useState } from "react";
import { Link } from "react-router";
import {
	availableBalance,
	canManageTreasury,
	estimatedDailyEarnings,
	type OrgAccount,
} from "../../domain/account.ts";
import { inboxFor } from "../../domain/inbox.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatMoney, formatRate } from "../../ui/format.ts";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { RequestCard } from "../requests/RequestCard.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AccountNumberCard } from "./AccountNumberCard.tsx";
import { ActivityList } from "./ActivityList.tsx";
import styles from "./OverviewPage.module.css";
import { type ReserveDirection, ReserveSheet } from "./ReserveSheet.tsx";

export function OverviewPage() {
	return <OrgRequired>{(account) => <Overview account={account} />}</OrgRequired>;
}

function Overview({ account }: { account: OrgAccount }) {
	const { workspace, me, dataSource } = useWorkspace();
	const { run, busy } = useCommand();
	const onTestnet = dataSource.kind === "testnet";
	const [reserveSheet, setReserveSheet] = useState<ReserveDirection | null>(null);
	const waiting = inboxFor(workspace, me.id).filter(
		(item) => item.account.org.id === account.org.id,
	);
	const available = availableBalance(account);
	const committed = account.balance - available;
	const mayMove = canManageTreasury(account.org, me.id);

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Avatar name={account.org.name} imageUrl={account.logoUrl} size="lg" />
				<h1>{account.org.name}</h1>
			</header>

			<div className={styles.grid}>
				<Card title="Main account" tone="deep">
					<p className={styles.balance}>{formatMoney(account.balance, account.currency)}</p>
					<p className={styles.sub}>
						{committed > 0
							? `${formatMoney(available, account.currency)} available · ${formatMoney(committed, account.currency)} waiting in requests`
							: "All of it available"}
					</p>
					<div className={styles.actions}>
						<Link to="/app/pay" className={buttonClass()}>
							Send money
						</Link>
						{onTestnet ? (
							<button
								type="button"
								className={buttonClass("secondary")}
								disabled={busy}
								onClick={() =>
									run(() => dataSource.addTestMoney(account.org.id, me.id), {
										success: "Test money arrived on your account.",
									})
								}
							>
								Add test money
							</button>
						) : (
							<a href="#account-number" className={buttonClass("secondary")}>
								Add money
							</a>
						)}
					</div>
				</Card>

				<Card title="Reserve" action={dataSource.supportsReserve ? <SimulatedTag /> : null}>
					<p className={styles.amount}>{formatMoney(account.reserve, account.currency)}</p>
					<p className={styles.sub}>
						Earnings, variable: {formatRate(account.reserveRateBps)} a year right now, about{" "}
						{formatMoney(estimatedDailyEarnings(account), account.currency)} a day.
					</p>
					{!dataSource.supportsReserve && (
						<p className={styles.sub}>
							Not connected on testnet yet. Idle money will earn in a DeFindex vault.
						</p>
					)}
					{mayMove && dataSource.supportsReserve && (
						<div className={styles.actions}>
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => setReserveSheet("in")}
							>
								Move to Reserve
							</button>
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => setReserveSheet("out")}
								disabled={account.reserve === 0}
							>
								Move to account
							</button>
						</div>
					)}
				</Card>
			</div>

			{waiting.length > 0 && (
				<section className={styles.section}>
					<h2>Waiting for you</h2>
					{waiting.map((item) => (
						<RequestCard key={item.request.id} account={account} request={item.request} />
					))}
				</section>
			)}

			<div className={styles.grid}>
				<ActivityList account={account} />
				<AccountNumberCard account={account} />
			</div>

			<ReserveSheet
				account={account}
				direction={reserveSheet}
				onClose={() => setReserveSheet(null)}
			/>
		</div>
	);
}
