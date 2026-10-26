import { useState } from "react";
import {
	balanceOf,
	canManageTreasury,
	estimatedDailyEarnings,
	hasReserve,
	type OrgAccount,
} from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { DefindexBadge } from "../../ui/DefindexBadge.tsx";
import { formatMoney, formatRate, formatSignedMoney } from "../../ui/format.ts";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ReserveCard.module.css";
import { type ReserveDirection, ReserveSheet } from "./ReserveSheet.tsx";
import { TokenBadge } from "./TokenBadge.tsx";

/**
 * The Reserve as its own place on the overview: what sits in DeFindex vaults per asset, what it
 * has earned, and the one-tap moves for people with treasury rights.
 */
export function ReserveCard({ account }: { account: OrgAccount }) {
	const { me, dataSource } = useWorkspace();
	const [move, setMove] = useState<{ token: string; direction: ReserveDirection } | null>(null);
	const sample = dataSource.kind === "sample";
	const mayMove = canManageTreasury(account.org, me.id);
	const withVault = account.org.assets.filter(hasReserve);

	return (
		<div id="reserve">
			<Card
				title="Reserve"
				action={
					<span className={styles.actions}>
						{sample && <SimulatedTag />}
						<DefindexBadge />
					</span>
				}
			>
				<p className={styles.muted}>
					Money the organization doesn't need right now earns in a DeFindex vault on Stellar.
					Earnings are variable, moves are one tap and need no approval because the money never
					leaves the organization. Not a bank deposit; not insured.
				</p>
				{withVault.length === 0 ? (
					<p className={styles.muted}>
						None of the accepted assets has a DeFindex vault on testnet yet; BlendUSDC has one.
					</p>
				) : (
					<ul className={styles.list}>
						{withVault.map((asset) => {
							const { reserve, earnings } = balanceOf(account, asset.token);
							return (
								<li key={asset.token} className={styles.line}>
									<TokenBadge asset={asset} />
									<span className={styles.text}>
										<span className={styles.amount}>{formatMoney(reserve, asset.currency)}</span>
										<span className={styles.muted}>
											{sample
												? `${formatRate(account.reserveRateBps)} a year right now · about ${formatMoney(estimatedDailyEarnings(account, asset.token), asset.currency)} a day`
												: earnings !== undefined && reserve > 0
													? `${formatSignedMoney(earnings, asset.currency)} earned so far · Blend lending, variable`
													: "Blend lending on testnet, variable"}
										</span>
									</span>
									{mayMove && (
										<span className={styles.buttons}>
											<button
												type="button"
												className={buttonClass("secondary")}
												onClick={() => setMove({ token: asset.token, direction: "in" })}
											>
												Move in
											</button>
											<button
												type="button"
												className={buttonClass("secondary")}
												disabled={reserve === 0}
												onClick={() => setMove({ token: asset.token, direction: "out" })}
											>
												Move out
											</button>
										</span>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</Card>
			{move && (
				<ReserveSheet
					account={account}
					token={move.token}
					direction={move.direction}
					onClose={() => setMove(null)}
				/>
			)}
		</div>
	);
}
