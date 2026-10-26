import { useState } from "react";
import {
	availableBalance,
	balanceOf,
	hasReserve,
	isForeign,
	type OrgAccount,
	primaryToken,
} from "../../domain/account.ts";
import { inboxFor } from "../../domain/inbox.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { Card } from "../../ui/Card.tsx";
import { formatMoney } from "../../ui/format.ts";
import { ChevronDownIcon } from "../../ui/icons.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { RequestCard } from "../requests/RequestCard.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AccountNumberCard } from "./AccountNumberCard.tsx";
import { ActivityList } from "./ActivityList.tsx";
import { AssetSheet } from "./AssetSheet.tsx";
import { BudgetsCard } from "./BudgetsCard.tsx";
import { MoneyHeadline } from "./MoneyHeadline.tsx";
import styles from "./OverviewPage.module.css";
import { ReserveCard } from "./ReserveCard.tsx";
import { describeAsset, TokenBadge } from "./TokenBadge.tsx";

export function OverviewPage() {
	return <OrgRequired>{(account) => <Overview account={account} />}</OrgRequired>;
}

function Overview({ account }: { account: OrgAccount }) {
	const { workspace, me, dataSource } = useWorkspace();
	const [open, setOpen] = useState<Asset | null>(null);
	const waiting = inboxFor(workspace, me.id).filter(
		(item) => item.account.org.id === account.org.id,
	);
	const sample = dataSource.kind === "sample";
	const base = account.org.baseCurrency;
	const lead = primaryToken(account);
	// Home-currency assets add up to the headline; other currencies are listed next to it.
	const assets = [...account.org.assets].sort((a, b) =>
		a.token === lead ? -1 : b.token === lead ? 1 : 0,
	);
	const leadAsset = assets.find((a) => a.token === lead) ?? assets[0] ?? null;

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Avatar name={account.org.name} imageUrl={account.logoUrl} size="lg" />
				<h1>{account.org.name}</h1>
			</header>

			<MoneyHeadline account={account} onAdd={leadAsset ? () => setOpen(leadAsset) : null} />

			<Card title="Accounts" action={sample ? <SimulatedTag /> : null}>
				<ul className={styles.assetList}>
					{assets.map((asset) => {
						const { balance, reserve } = balanceOf(account, asset.token);
						const available = availableBalance(account, asset.token);
						return (
							<li key={asset.token}>
								<button
									type="button"
									className={styles.assetRow}
									onClick={() => setOpen(asset)}
									aria-label={`${asset.symbol}: ${formatMoney(balance, asset.currency)}`}
								>
									<TokenBadge asset={asset} />
									<span className={styles.assetText}>
										<span className={styles.assetSymbol}>{asset.symbol}</span>
										<span className={styles.sub}>{describeAsset(asset)}</span>
									</span>
									<span className={styles.assetAmount}>
										<span className={styles.assetBalance}>
											{formatMoney(available, asset.currency)}
										</span>
										<span className={styles.sub}>
											available
											{hasReserve(asset) && reserve > 0
												? ` · Reserve ${formatMoney(reserve, asset.currency)}`
												: ""}
											{balance !== available || reserve > 0
												? ` · total ${formatMoney(balance + reserve, asset.currency)}`
												: ""}
										</span>
									</span>
									<span className={styles.chevron}>
										<ChevronDownIcon />
									</span>
								</button>
							</li>
						);
					})}
				</ul>
				<p className={styles.sub}>
					Rules are written in {base}
					{assets.some((a) => isForeign(account.org, a.token)) &&
						"; payments in another currency take the strictest tier"}
					. Tap an account for its Reserve and the ways to add money.
				</p>
			</Card>

			<ReserveCard account={account} />

			{waiting.length > 0 && (
				<section className={styles.section}>
					<h2>Waiting for you</h2>
					{waiting.map((item) => (
						<RequestCard key={item.request.id} account={account} request={item.request} />
					))}
				</section>
			)}

			<BudgetsCard account={account} />

			<div className={styles.grid}>
				<ActivityList account={account} />
				<AccountNumberCard account={account} />
			</div>

			<AssetSheet account={account} asset={open} onClose={() => setOpen(null)} />
		</div>
	);
}
