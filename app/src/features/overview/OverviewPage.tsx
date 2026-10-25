import { useState } from "react";
import { Link } from "react-router";
import {
	availableBalance,
	balanceOf,
	canManageTreasury,
	estimatedDailyEarnings,
	isForeign,
	type OrgAccount,
	primaryToken,
} from "../../domain/account.ts";
import { inboxFor } from "../../domain/inbox.ts";
import type { Asset } from "../../domain/rules/model.ts";
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
	const [reserveSheet, setReserveSheet] = useState<{
		token: string;
		direction: ReserveDirection;
	} | null>(null);
	const waiting = inboxFor(workspace, me.id).filter(
		(item) => item.account.org.id === account.org.id,
	);
	const mayMove = canManageTreasury(account.org, me.id);
	const lead = primaryToken(account);
	// The rules' currency first, then the rest in the order the organization accepted them.
	const assets = [...account.org.assets].sort((a, b) =>
		a.token === lead ? -1 : b.token === lead ? 1 : 0,
	);

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Avatar name={account.org.name} imageUrl={account.logoUrl} size="lg" />
				<h1>{account.org.name}</h1>
			</header>

			<div className={styles.grid}>
				{assets.map((asset) => (
					<BalanceCard
						key={asset.token}
						account={account}
						asset={asset}
						lead={asset.token === lead}
					/>
				))}
			</div>

			<Card title="Reserve" action={dataSource.supportsReserve ? <SimulatedTag /> : null}>
				<ul className={styles.reserveList}>
					{assets.map((asset) => {
						const { reserve } = balanceOf(account, asset.token);
						return (
							<li key={asset.token} className={styles.reserveRow}>
								<span className={styles.reserveAsset}>{asset.symbol}</span>
								<span className={styles.amount}>{formatMoney(reserve, asset.currency)}</span>
								{mayMove && dataSource.supportsReserve && (
									<span className={styles.actions}>
										<button
											type="button"
											className={buttonClass("secondary")}
											onClick={() => setReserveSheet({ token: asset.token, direction: "in" })}
										>
											Move to Reserve
										</button>
										<button
											type="button"
											className={buttonClass("secondary")}
											onClick={() => setReserveSheet({ token: asset.token, direction: "out" })}
											disabled={reserve === 0}
										>
											Move to account
										</button>
									</span>
								)}
							</li>
						);
					})}
				</ul>
				<p className={styles.sub}>
					Earnings, variable: {formatRate(account.reserveRateBps)} a year right now
					{assets[0] &&
						`, about ${formatMoney(estimatedDailyEarnings(account, lead), assets[0].currency)} a day on the ${assets[0].symbol} Reserve`}
					.
				</p>
				{!dataSource.supportsReserve && (
					<p className={styles.sub}>
						Not connected on testnet yet. Idle money will earn in a DeFindex vault, asset by asset.
					</p>
				)}
			</Card>

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
				token={reserveSheet?.token ?? lead}
				direction={reserveSheet?.direction ?? null}
				onClose={() => setReserveSheet(null)}
			/>
		</div>
	);
}

/** One accepted asset: its balance, what's free, and how to add or send money in it. */
function BalanceCard({
	account,
	asset,
	lead,
}: {
	account: OrgAccount;
	asset: Asset;
	lead: boolean;
}) {
	const { me, dataSource } = useWorkspace();
	const { run, busy } = useCommand();
	const onTestnet = dataSource.kind === "testnet";
	const { balance } = balanceOf(account, asset.token);
	const available = availableBalance(account, asset.token);
	const committed = balance - available;
	const foreign = isForeign(account.org, asset.token);

	return (
		<Card title={`${asset.symbol} account`} tone={lead ? "deep" : "default"}>
			<p className={lead ? styles.balance : styles.amount}>
				{formatMoney(balance, asset.currency)}
			</p>
			<p className={styles.sub}>
				{committed > 0
					? `${formatMoney(available, asset.currency)} available · ${formatMoney(committed, asset.currency)} waiting in requests`
					: "All of it available"}
				{foreign &&
					` · rules are in ${account.org.baseCurrency}, so payments in ${asset.symbol} take the strictest tier`}
			</p>
			<div className={styles.actions}>
				<Link to={`/app/pay?token=${encodeURIComponent(asset.token)}`} className={buttonClass()}>
					Send {asset.symbol}
				</Link>
				{onTestnet ? (
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() =>
							run(() => dataSource.addTestMoney(account.org.id, me.id, asset.token), {
								success: `Test ${asset.symbol} arrived on the account.`,
							})
						}
					>
						Add test {asset.symbol}
					</button>
				) : (
					<a href="#account-number" className={buttonClass("secondary")}>
						Add money
					</a>
				)}
			</div>
		</Card>
	);
}
