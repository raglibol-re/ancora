import { Link } from "react-router";
import { availableBalance, balanceOf, isForeign, type OrgAccount } from "../../domain/account.ts";
import { convertCents, formatRate, type Quote } from "../../domain/fx.ts";
import type { Cents } from "../../domain/money.ts";
import type { Asset } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatMoney } from "../../ui/format.ts";
import styles from "./MoneyHeadline.module.css";
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
			<p className={styles.eyebrow}>Total · {base}</p>
			<p className={styles.balance}>{formatMoney(total, base)}</p>
			{converted.length > 0 && (
				<p className={styles.sub}>
					Includes{" "}
					{converted
						.map(
							(c) =>
								`${formatMoney(c.amount, c.asset.currency)} ${c.asset.symbol} ≈ ${formatMoney(c.inBase, base)} at ${formatRate(c.quote.microRate)}`,
						)
						.join(" and ")}{" "}
					({converted[0]?.quote.label}
					{simulatedRate ? ", Simulated" : ""}). Rates are for this view only; the rules don't use
					them.
				</p>
			)}
			{unpriced.length > 0 && (
				<p className={styles.sub}>
					{unpriced.map((a) => a.symbol).join(", ")} not included: no rate available right now.
				</p>
			)}
			<div
				className={styles.bar}
				role="img"
				aria-label={`${formatMoney(available, base)} available, ${formatMoney(waiting, base)} waiting in requests, ${formatMoney(reserve, base)} in the Reserve`}
			>
				<span className={styles.segmentAvailable} style={{ width: share(available) }} />
				<span className={styles.segmentWaiting} style={{ width: share(waiting) }} />
				<span className={styles.segmentReserve} style={{ width: share(reserve) }} />
			</div>
			<ul className={styles.legend}>
				<li>
					<span className={`${styles.dot} ${styles.dotAvailable}`} />
					<span className={styles.legendLabel}>Available now</span>
					<strong>{formatMoney(available, base)}</strong>
				</li>
				<li>
					<span className={`${styles.dot} ${styles.dotWaiting}`} />
					<span className={styles.legendLabel}>Waiting in requests</span>
					<strong>{formatMoney(waiting, base)}</strong>
				</li>
				<li>
					<span className={`${styles.dot} ${styles.dotReserve}`} />
					<span className={styles.legendLabel}>In the Reserve, earning</span>
					<strong>{formatMoney(reserve, base)}</strong>
				</li>
			</ul>
			<div className={styles.actions}>
				<Link to="/app/pay" className={buttonClass()}>
					Send money
				</Link>
				{onAdd && (
					<button type="button" className={buttonClass("secondary")} onClick={onAdd}>
						Add money
					</button>
				)}
			</div>
		</Card>
	);
}
