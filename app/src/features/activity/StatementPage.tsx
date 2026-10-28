import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { balanceOf, currencyOf, type OrgAccount } from "../../domain/account.ts";
import { filterItems, monthOf, statementItems, totalsByAsset } from "../../domain/statement.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { formatDateTime, formatMoney, formatSignedMoney } from "../../ui/format.ts";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./StatementPage.module.css";
import { asCurrency, displayParty, monthLabel, statementNames } from "./statementNames.ts";

/**
 * A month's statement as a document: per asset the money in and out, today's balance and every
 * movement. Printing keeps only the document, so "Save as PDF" in the print dialog gives a clean
 * file without a PDF library.
 */
export function StatementPage() {
	return (
		<OrgRequired>{(account) => <Statement key={account.org.id} account={account} />}</OrgRequired>
	);
}

function Statement({ account }: { account: OrgAccount }) {
	const { personName } = useWorkspace();
	const [params] = useSearchParams();
	const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "")
		? (params.get("month") as string)
		: monthOf(Date.now());
	const onlyToken = params.get("token");
	const items = useMemo(
		() => statementItems(account, statementNames(account, personName)),
		[account, personName],
	);
	const inMonth = filterItems(items, {
		query: "",
		direction: "all",
		token: onlyToken,
		month,
	});
	const assets = account.org.assets.filter((a) => !onlyToken || a.token === onlyToken);
	const totals = new Map(totalsByAsset(inMonth).map((t) => [t.token, t]));

	return (
		<div className={styles.page}>
			<div className={styles.toolbar}>
				<Link to="/app/activity" className={buttonClass("secondary")}>
					Back to activity
				</Link>
				<button type="button" className={buttonClass()} onClick={() => window.print()}>
					Print or save as PDF
				</button>
			</div>
			<article className={styles.document} aria-label={`Statement for ${monthLabel(month)}`}>
				<header className={styles.head}>
					<div>
						<p className={styles.kicker}>Statement · {monthLabel(month)}</p>
						<h1 className={styles.org}>{account.org.name}</h1>
						<p className={styles.small}>
							{account.onchain
								? `Account on Stellar testnet: ${account.onchain.contractId}`
								: "Sample data, not on Stellar."}
							{!account.onchain && (
								<>
									{" "}
									<SimulatedTag />
								</>
							)}
						</p>
					</div>
					<p className={styles.small}>Created {formatDateTime(Date.now())} by ancora</p>
				</header>

				{assets.map((asset) => {
					const currency = currencyOf(account, asset.token);
					const total = totals.get(asset.token);
					const balance = balanceOf(account, asset.token);
					const rows = inMonth.filter((i) => i.token === asset.token);
					return (
						<section key={asset.token} className={styles.asset}>
							<h2>{asset.symbol}</h2>
							<dl className={styles.summary}>
								<div>
									<dt>Money in</dt>
									<dd>{formatMoney(total?.moneyIn ?? 0, currency)}</dd>
								</div>
								<div>
									<dt>Money out</dt>
									<dd>{formatMoney(total?.moneyOut ?? 0, currency)}</dd>
								</div>
								<div>
									<dt>Net this month</dt>
									<dd>{formatSignedMoney(total?.net ?? 0, currency)}</dd>
								</div>
								<div>
									<dt>Balance today</dt>
									<dd>{formatMoney(balance.balance + balance.reserve, currency)}</dd>
								</div>
							</dl>
							{rows.length === 0 ? (
								<p className={styles.small}>No movements in {monthLabel(month)}.</p>
							) : (
								<table className={styles.table}>
									<thead>
										<tr>
											<th scope="col">Date</th>
											<th scope="col">Description</th>
											<th scope="col">Reference</th>
											<th scope="col" className={styles.right}>
												Amount
											</th>
										</tr>
									</thead>
									<tbody>
										{rows.map((item) => (
											<tr key={`${item.at}-${item.row.transaction}-${item.cents}`}>
												<td>{formatDateTime(item.at)}</td>
												<td>
													{item.row.type.charAt(0).toUpperCase() + item.row.type.slice(1)}
													{item.row.counterparty &&
														` · ${displayParty(account, item.row.counterparty)}`}
												</td>
												<td>
													{item.row.reference}
													{item.row.category && ` #${item.row.category}`}
												</td>
												<td className={styles.right}>
													{formatSignedMoney(item.cents, asCurrency(item.row.currency))}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</section>
					);
				})}

				<footer className={styles.foot}>
					ancora is not a bank; balances are not deposit-insured. Amounts are in each asset's own
					currency. Reserve moves stay inside the organization and count in neither direction.
					{account.onchain &&
						" Payments come from the organization's contract, deposits from the Stellar ledger as far back as this device has read them; every transaction is on stellar.expert."}
				</footer>
			</article>
		</div>
	);
}
