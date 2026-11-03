import { availableBalance, balanceOf, isForeign, type OrgAccount } from "../../domain/account.ts";
import { convertCents, formatRate, type Quote } from "../../domain/fx.ts";
import type { Cents } from "../../domain/money.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { Card } from "../../ui/Card.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./MoneyHeadline.module.css";
import { QuickActions } from "./QuickActions.tsx";
import { useFxRates } from "./useFxRates.ts";

type MoneyHeadlineProps = {
	account: OrgAccount;
	onAdd: (() => void) | null;
};

type Converted = { asset: Asset; amount: Cents; inBase: Cents; quote: Quote };

/**
 * Everything the organization holds, in its home currency: main account, requests in flight
 * and the Reserve, with other currencies converted at an indicative rate for the headline only.
 */
export function MoneyHeadline({ account, onAdd }: MoneyHeadlineProps) {
	const t = useT();
	const base = account.org.baseCurrency;
	const quotes = useFxRates(
		account.org.assets.map((a) => a.currency),
		base,
	);
	let available = 0;
	let waiting = 0;
	let reserve = 0;
	const converted: Converted[] = [];
	const unpriced: Asset[] = [];
	for (const asset of account.org.assets) {
		const { balance, reserve: inReserve } = balanceOf(account, asset.token);
		const free = availableBalance(account, asset.token);
		if (!isForeign(account.org, asset.token)) {
			available += free;
			waiting += balance - free;
			reserve += inReserve;
			continue;
		}
		if (balance + inReserve === 0) continue;
		const quote = quotes[asset.currency];
		if (!quote) {
			unpriced.push(asset);
			continue;
		}
		available += convertCents(free, quote.microRate);
		waiting += convertCents(balance - free, quote.microRate);
		reserve += convertCents(inReserve, quote.microRate);
		converted.push({
			asset,
			amount: balance + inReserve,
			inBase: convertCents(balance + inReserve, quote.microRate),
			quote,
		});
	}
	const total = available + waiting + reserve;
	const share = (part: Cents) => (total > 0 ? `${(part / total) * 100}%` : "0%");
	const simulatedRate = converted.some((c) => c.quote.simulated);

	return (
		<Card tone="deep">
			<p className={styles.eyebrow}>
				{t("Total ·")} {base}
			</p>
			<p className={styles.balance}>{formatMoney(total, base)}</p>
			{converted.length > 0 && (
				<p className={styles.sub}>
					{t("Includes")}{" "}
					{converted
						.map((c) =>
							t("{amount} {asset} ≈ {converted} at {rate}", {
								amount: formatMoney(c.amount, c.asset.currency),
								asset: c.asset.symbol,
								converted: formatMoney(c.inBase, base),
								rate: formatRate(c.quote.microRate),
							}),
						)
						.join(t(" and "))}{" "}
					({t(converted[0]?.quote.label ?? "")}
					{simulatedRate ? t(", Simulated") : ""}
					{t("). Rates are for this view only; the rules don't use them.")}
				</p>
			)}
			{unpriced.length > 0 && (
				<p className={styles.sub}>
					{unpriced.map((a) => a.symbol).join(", ")}{" "}
					{t("not included: no rate available right now.")}
				</p>
			)}
			<div
				className={styles.bar}
				role="img"
				aria-label={t(
					"{available} available, {waiting} waiting in requests, {reserve} in the Reserve",
					{
						available: formatMoney(available, base),
						waiting: formatMoney(waiting, base),
						reserve: formatMoney(reserve, base),
					},
				)}
			>
				<span className={styles.segmentAvailable} style={{ width: share(available) }} />
				<span className={styles.segmentWaiting} style={{ width: share(waiting) }} />
				<span className={styles.segmentReserve} style={{ width: share(reserve) }} />
			</div>
			<ul className={styles.legend}>
				<li>
					<span className={`${styles.dot} ${styles.dotAvailable}`} />
					<span className={styles.legendLabel}>{t("Available now")}</span>
					<strong>{formatMoney(available, base)}</strong>
				</li>
				<li>
					<span className={`${styles.dot} ${styles.dotWaiting}`} />
					<span className={styles.legendLabel}>{t("Waiting in requests")}</span>
					<strong>{formatMoney(waiting, base)}</strong>
				</li>
				<li>
					<span className={`${styles.dot} ${styles.dotReserve}`} />
					<span className={styles.legendLabel}>{t("In the Reserve · DeFindex")}</span>
					<strong>{formatMoney(reserve, base)}</strong>
				</li>
			</ul>
			<QuickActions onAdd={onAdd} />
		</Card>
	);
}
