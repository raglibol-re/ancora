import type { OrgAccount } from "../../domain/account.ts";
import { displayRate } from "../../domain/rules/controls.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Controls.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * Live exchange rates for the approvals: a payment in another currency is judged at today's
 * rate instead of always taking the strictest approvals and the seal.
 */
export function ExchangeRatesCard({ account }: { account: OrgAccount }) {
	const { dataSource } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const oracle = dataSource.fxOracle;
	if (!oracle) return null;
	const { org } = account;
	const now = Date.now();
	const others = [...new Set(org.assets.map((a) => a.currency))].filter(
		(c) => c !== org.baseCurrency,
	);

	const rateLine = (currency: (typeof others)[number]) => {
		const rate = displayRate(org, currency, now);
		if (rate === null) return `No current rate for ${currency}: strictest approvals.`;
		const at = org.fx?.prices[currency]?.at;
		const shown = rate.toLocaleString("en-IE", { maximumFractionDigits: 4 });
		return `1 ${currency} = ${shown} ${org.baseCurrency}${at ? ` · ${formatDateTime(at)}` : ""}`;
	};

	return (
		<Card title="Exchange rates">
			{org.fx ? (
				<>
					<p className={styles.muted}>
						Payments in other currencies are judged at the live rate from Reflector, a price service
						on Stellar. Without a rate from the last four days they take the strictest approvals and
						the seal, so nothing is ever under-approved.
					</p>
					<ul className={styles.list}>
						{others.length === 0 && (
							<li className={styles.item}>All accepted assets are in {org.baseCurrency}.</li>
						)}
						{others.map((currency) => (
							<li key={currency} className={styles.item}>
								{rateLine(currency)}
							</li>
						))}
					</ul>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => propose({ type: "setFxOracle", oracle: null })}
					>
						Stop using live rates
					</button>
				</>
			) : (
				<>
					<p className={styles.muted}>
						Today a payment in another currency than {org.baseCurrency} takes the strictest
						approvals and the seal. With live rates it is judged by its value in {org.baseCurrency}.
					</p>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => propose({ type: "setFxOracle", oracle })}
					>
						Use live exchange rates
					</button>
				</>
			)}
		</Card>
	);
}
