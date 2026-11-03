import { useState } from "react";
import { Link } from "react-router";
import {
	availableBalance,
	balanceOf,
	canManageTreasury,
	estimatedDailyEarnings,
	hasReserve,
	isForeign,
	type OrgAccount,
} from "../../domain/account.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { DefindexBadge } from "../../ui/DefindexBadge.tsx";
import { formatMoney, formatRate, formatSignedMoney } from "../../ui/format.ts";
import { Sheet } from "../../ui/Sheet.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AddMoneySheet } from "./AddMoneySheet.tsx";
import styles from "./AssetSheet.module.css";
import { BankWithdrawSheet } from "./BankWithdrawSheet.tsx";
import { type ReserveDirection, ReserveSheet } from "./ReserveSheet.tsx";
import { TokenBadge } from "./TokenBadge.tsx";

type AssetSheetProps = {
	account: OrgAccount;
	asset: Asset | null;
	onClose: () => void;
};

/** One stablecoin of the organization: balance, what's free, its Reserve, and the ways in and out. */
export function AssetSheet({ account, asset, onClose }: AssetSheetProps) {
	const t = useT();
	const { me, dataSource } = useWorkspace();
	const [adding, setAdding] = useState(false);
	const [reserve, setReserve] = useState<ReserveDirection | null>(null);
	const [toBank, setToBank] = useState(false);
	if (!asset) return null;
	const { balance, reserve: inReserve, earnings } = balanceOf(account, asset.token);
	const available = availableBalance(account, asset.token);
	const committed = balance - available;
	const foreign = isForeign(account.org, asset.token);
	const mayMove = canManageTreasury(account.org, me.id);
	const sample = dataSource.kind === "sample";

	return (
		<>
			<Sheet
				open={asset !== null && !adding && reserve === null && !toBank}
				title={asset.symbol}
				onClose={onClose}
			>
				<div className={styles.body}>
					<div className={styles.hero}>
						<TokenBadge asset={asset} size="lg" />
						<div>
							<p className={styles.balance}>{formatMoney(balance, asset.currency)}</p>
							<p className={styles.muted}>
								{committed > 0
									? t("{available} available · {waiting} waiting in requests", {
											available: formatMoney(available, asset.currency),
											waiting: formatMoney(committed, asset.currency),
										})
									: t("All of it available")}
							</p>
						</div>
					</div>
					{foreign && (
						<p className={styles.muted}>
							{t("The rules are written in")} {account.org.baseCurrency}
							{t("; payments in")} {asset.symbol}{" "}
							{t("take the strictest tier until a live exchange rate is connected.")}
						</p>
					)}
					<div className={styles.actions}>
						<Link
							to={`/app/pay?token=${encodeURIComponent(asset.token)}`}
							className={buttonClass()}
							onClick={onClose}
						>
							{t("Send")} {asset.symbol}
						</Link>
						{sample ? (
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => {
									onClose();
									document.getElementById("account-number")?.scrollIntoView({ behavior: "smooth" });
								}}
							>
								{t("Add money")}
							</button>
						) : (
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => setAdding(true)}
							>
								{t("Add")} {asset.symbol}
							</button>
						)}
						{dataSource.ramps && (
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => setToBank(true)}
							>
								{t("To a bank account")}
							</button>
						)}
					</div>

					<section className={styles.reserve}>
						<div className={styles.reserveHead}>
							<h3>{t("Reserve")}</h3>
							<DefindexBadge compact />
						</div>
						{hasReserve(asset) ? (
							<>
								<p className={styles.reserveValue}>{formatMoney(inReserve, asset.currency)}</p>
								<p className={styles.muted}>
									{sample
										? `Earnings, variable: ${formatRate(account.reserveRateBps)} a year right now, about ${formatMoney(estimatedDailyEarnings(account, asset.token), asset.currency)} a day.`
										: earnings !== undefined && inReserve > 0
											? `${formatSignedMoney(earnings, asset.currency)} earned so far in the DeFindex vault (Blend lending, variable).`
											: t(
													"Earns in a DeFindex vault on Stellar testnet (Blend lending, variable).",
												)}
								</p>
								{mayMove && (
									<div className={styles.actions}>
										<button
											type="button"
											className={buttonClass("secondary")}
											onClick={() => setReserve("in")}
										>
											{t("Move to Reserve")}
										</button>
										<button
											type="button"
											className={buttonClass("secondary")}
											disabled={inReserve === 0}
											onClick={() => setReserve("out")}
										>
											{t("Move to account")}
										</button>
									</div>
								)}
							</>
						) : (
							<p className={styles.muted}>
								{t("No Reserve for")} {asset.symbol} {t("yet.")}
							</p>
						)}
					</section>
				</div>
			</Sheet>
			{!sample && (
				<AddMoneySheet
					account={account}
					asset={asset}
					open={adding}
					onClose={() => setAdding(false)}
				/>
			)}
			{dataSource.ramps && (
				<BankWithdrawSheet
					account={account}
					asset={asset}
					open={toBank}
					onClose={() => setToBank(false)}
				/>
			)}
			<ReserveSheet
				account={account}
				token={asset.token}
				direction={reserve}
				onClose={() => setReserve(null)}
			/>
		</>
	);
}
