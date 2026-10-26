import { useState } from "react";
import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { evaluatePayment } from "../../domain/rules/policy.ts";
import type { RequestStatus } from "../../domain/rules/requests.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { describeEvaluation } from "../requests/describe.ts";
import { RequestCard } from "../requests/RequestCard.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import styles from "./ApprovalsPage.module.css";

type Filter = "open" | "scheduled" | "done";

const statusesFor: Readonly<Record<Filter, readonly RequestStatus[]>> = {
	open: ["pending", "ready", "escrowed"],
	scheduled: ["scheduled"],
	done: ["executed", "declined", "failed"],
};

export function ApprovalsPage() {
	return <OrgRequired>{(account) => <Approvals account={account} />}</OrgRequired>;
}

function Approvals({ account }: { account: OrgAccount }) {
	const [filter, setFilter] = useState<Filter>("open");
	const count = (f: Filter) =>
		account.requests.filter((r) => statusesFor[f].includes(r.status)).length;
	const shown = account.requests.filter((r) => statusesFor[filter].includes(r.status));

	return (
		<Page title="Approvals" lead={`Payments and changes in ${account.org.name}.`}>
			<Segmented
				label="Show requests"
				value={filter}
				onChange={setFilter}
				options={[
					{ value: "open", label: "Open", count: count("open") },
					{ value: "scheduled", label: "Objection window", count: count("scheduled") },
					{ value: "done", label: "Done", count: count("done") },
				]}
			/>
			{shown.length === 0 ? (
				<Card title={filter === "open" ? "Nothing waits for approval" : "Nothing here yet"}>
					<p>
						Every payment and every change to people or rules becomes a request here. Your rules
						decide who approves what:
					</p>
					<ul>
						{account.org.policy.tiers.map((tier, index) => {
							const from = account.org.policy.tiers[index - 1]?.upTo ?? 0;
							const amount = tier.upTo ?? from + 1;
							const evaluation = evaluatePayment(account.org.policy, {
								amount,
								recipientIsNew: false,
							});
							return (
								<li key={tier.upTo ?? "top"}>
									{tier.upTo === null
										? `Above ${formatMoney(from, account.org.baseCurrency)}: `
										: `Up to ${formatMoney(tier.upTo, account.org.baseCurrency)}: `}
									{describeEvaluation(account.org, evaluation)}
								</li>
							);
						})}
					</ul>
					<div className={styles.emptyActions}>
						<Link to="/app/pay" className={buttonClass()}>
							Send a payment
						</Link>
						<Link to="/app/rules#people" className={buttonClass("secondary")}>
							Invite a member
						</Link>
					</div>
				</Card>
			) : (
				shown.map((request) => <RequestCard key={request.id} account={account} request={request} />)
			)}
		</Page>
	);
}
