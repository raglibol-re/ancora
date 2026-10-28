import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import {
	type Direction,
	filterItems,
	monthOf,
	statementCsv,
	statementItems,
	statementMonths,
	totalsByAsset,
} from "../../domain/statement.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatDateTime, formatMoney, formatSignedMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { saveCsv } from "../overview/downloadStatement.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ActivityPage.module.css";
import { asCurrency, displayParty, monthLabel, statementNames } from "./statementNames.ts";

export function ActivityPage() {
	return (
		<Page title="Activity" lead="Every movement of the organization's money, searchable.">
			<OrgRequired>{(account) => <Activity key={account.org.id} account={account} />}</OrgRequired>
		</Page>
	);
}

const DIRECTIONS: { value: Direction; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "in", label: "In" },
	{ value: "out", label: "Out" },
	{ value: "reserve", label: "Reserve" },
];

function Activity({ account }: { account: OrgAccount }) {
	const { personName } = useWorkspace();
	const items = useMemo(
		() => statementItems(account, statementNames(account, personName)).reverse(),
		[account, personName],
	);
	const months = useMemo(() => statementMonths(items), [items]);
	const [query, setQuery] = useState("");
	const [direction, setDirection] = useState<Direction>("all");
	const [token, setToken] = useState<string>("");
	const [month, setMonth] = useState<string>("");
	const filtered = filterItems(items, {
		query,
		direction,
		token: token || null,
		month: month || null,
	});
	const totals = totalsByAsset(filtered);
	const symbolOf = (t: string) => account.org.assets.find((a) => a.token === t)?.symbol ?? t;
	const statementMonth = month || monthOf(Date.now());

	return (
		<>
			<Card title="Find">
				<div className={styles.filters}>
					<Field label="Search" htmlFor="activity-search">
						<input
							id="activity-search"
							type="search"
							className={controlClass}
							value={query}
							placeholder="Name, reference, category or amount"
							onChange={(e) => setQuery(e.target.value)}
						/>
					</Field>
					<Field label="Asset" htmlFor="activity-asset">
						<select
							id="activity-asset"
							className={controlClass}
							value={token}
							onChange={(e) => setToken(e.target.value)}
						>
							<option value="">All assets</option>
							{account.org.assets.map((asset) => (
								<option key={asset.token} value={asset.token}>
									{asset.symbol}
								</option>
							))}
						</select>
					</Field>
					<Field label="Month" htmlFor="activity-month">
						<select
							id="activity-month"
							className={controlClass}
							value={month}
							onChange={(e) => setMonth(e.target.value)}
						>
							<option value="">All months</option>
							{months.map((m) => (
								<option key={m} value={m}>
									{monthLabel(m)}
								</option>
							))}
						</select>
					</Field>
				</div>
				<Segmented<Direction>
					label="Direction"
					value={direction}
					onChange={setDirection}
					options={DIRECTIONS}
				/>
				{totals.length > 0 && (
					<ul className={styles.totals}>
						{totals.map((t) => {
							const currency = asCurrency(
								filtered.find((i) => i.token === t.token)?.row.currency ?? "EUR",
							);
							return (
								<li key={t.token}>
									<strong>{symbolOf(t.token)}</strong> in {formatMoney(t.moneyIn, currency)} · out{" "}
									{formatMoney(t.moneyOut, currency)} · net {formatSignedMoney(t.net, currency)}
								</li>
							);
						})}
					</ul>
				)}
				<div className={styles.actions}>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={filtered.length === 0}
						onClick={() =>
							saveCsv(
								account,
								statementCsv([...filtered].reverse().map((i) => i.row)),
								month || "all",
							)
						}
					>
						Download these as CSV
					</button>
					<Link
						to={`/app/statement?month=${statementMonth}${token ? `&token=${token}` : ""}`}
						className={buttonClass("secondary")}
					>
						Statement for {monthLabel(statementMonth)}
					</Link>
				</div>
			</Card>

			<Card title={`${filtered.length} ${filtered.length === 1 ? "movement" : "movements"}`}>
				{filtered.length === 0 ? (
					<p className={styles.muted}>
						{items.length === 0
							? "No movements yet. Deposits, payments and Reserve moves appear here."
							: "Nothing matches. Clear the search or pick another month."}
					</p>
				) : (
					<ul className={styles.list}>
						{filtered.map((item) => {
							const currency = asCurrency(item.row.currency);
							const party = item.row.counterparty
								? displayParty(account, item.row.counterparty)
								: "";
							return (
								<li key={`${item.at}-${item.row.transaction}-${item.row.reference}-${item.cents}`}>
									<span className={styles.text}>
										<span className={styles.title}>
											{item.row.type.charAt(0).toUpperCase() + item.row.type.slice(1)}
											{party && ` · ${party}`}
										</span>
										<span className={styles.meta}>
											{formatDateTime(item.at)} · {item.row.asset}
											{item.row.reference && ` · ${item.row.reference}`}
											{item.row.category && ` · #${item.row.category}`}
											{item.row.by && ` · ${item.row.by}`}
										</span>
										{item.row.transaction && (
											<ExplorerLink target={item.row.transaction}>View transaction</ExplorerLink>
										)}
									</span>
									<span className={item.cents > 0 ? styles.positive : styles.amount}>
										{formatSignedMoney(item.cents, currency)}
									</span>
								</li>
							);
						})}
					</ul>
				)}
				{account.onchain && (
					<p className={styles.note}>
						Payments come from the organization's contract; deposits and Reserve moves from the
						Stellar ledger, about the last week plus what this device has read before.
					</p>
				)}
			</Card>
		</>
	);
}
