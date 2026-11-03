import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { currencyOf, type OrgAccount, shortAddress } from "../../domain/account.ts";
import {
	DEAL_STATUS_LABELS,
	type DealStep,
	MILESTONE_STATUS_LABELS,
	payoutAt,
	sideOf,
	stepsFor,
} from "../../domain/deals.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatDateTime, formatMoney, formatRelative } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { requestTitle } from "../requests/describe.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Deals.module.css";
import { describeDealAction } from "./describeDealAction.ts";
import { useDeals } from "./useDeals.ts";

export function DealDetailPage() {
	const t = useT();
	const { dealId } = useParams();
	return (
		<Page title={t("Deal #{id}", { id: dealId ?? "" })}>
			<OrgRequired>
				{(account) => <Detail key={account.org.id} account={account} dealId={Number(dealId)} />}
			</OrgRequired>
		</Page>
	);
}

/** Minute ticks keep the countdowns honest without re-rendering every second. */
function useNow(): number {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

function Detail({ account, dealId }: { account: OrgAccount; dealId: number }) {
	const t = useT();
	const { deals, error, support, reload } = useDeals(account);
	const { me, personName, myAccounts, preferences } = useWorkspace();
	const { run, busy } = useCommand();
	const now = useNow();
	const deal = deals?.find((d) => d.id === dealId);
	if (!support) return null;
	if (error) return <p className={styles.error}>{t(error)}</p>;
	if (!deals) return <p className={styles.muted}>{t("Reading the deal…")}</p>;
	if (!deal) {
		return (
			<Card>
				<p className={styles.muted}>
					{t("This organization takes no part in deal #")}
					{dealId}. <Link to="/app/deals">{t("All deals")}</Link>
				</p>
			</Card>
		);
	}
	const side = sideOf(deal, account.org.id);
	const currency = currencyOf(account, deal.token);
	const nameOf = (id: string) =>
		myAccounts.find((a) => a.org.id === id)?.org.name ?? shortAddress(id);
	const label = (_: number, index: number) =>
		deal.milestones[index]?.label ?? `milestone ${index + 1}`;
	// Steps waiting for this organization's own approvals.
	const pending = account.requests.filter(
		(r) =>
			r.kind === "deal" &&
			(r.status === "pending" || r.status === "scheduled") &&
			("dealId" in r.action ? r.action.dealId === deal.id : false),
	);

	const take = async (step: DealStep) => {
		const title = describeDealAction(step.action, label);
		const action = step.action;
		const result =
			action.type === "releaseNow"
				? await run(() => support.releaseNow(action.dealId, action.milestone), {
						signature: { kind: "passkey", title },
						success: t("Paid out."),
					})
				: await run(() => support.act(account.org.id, me.id, action), {
						signature: { kind: "passkey", title },
						success: (outcome) =>
							outcome === "applied"
								? "Done."
								: t("Approval requested: it goes out once your organization's rules are met."),
					});
		if (result?.ok) reload();
	};

	return (
		<>
			<Card title={t(DEAL_STATUS_LABELS[deal.status])}>
				<dl className={styles.facts}>
					<div>
						<dt>{side === "a" ? t("You pay") : t("You are paid by")}</dt>
						<dd>{side === "a" ? nameOf(deal.partyB) : nameOf(deal.partyA)}</dd>
					</div>
					<div>
						<dt>{t("Amount")}</dt>
						<dd>
							{formatMoney(deal.total, currency)}
							{deal.paidOut > 0 && ` · ${formatMoney(deal.paidOut, currency)} paid out`}
						</dd>
					</div>
					<div>
						<dt>{t("Time to object")}</dt>
						<dd>
							{Math.round((deal.objectionSeconds / 86_400) * 10) / 10} {t("days per payout")}
						</dd>
					</div>
					<div>
						<dt>{t("Arbiter")}</dt>
						<dd>{deal.arbiter ? nameOf(deal.arbiter) : t("None (disputes aren't possible)")}</dd>
					</div>
					<div>
						<dt>{t("Agreement fingerprint")}</dt>
						<dd>
							<code className={styles.code}>{deal.documentHash}</code>
						</dd>
					</div>
					{deal.cancelAsks.length === 1 && (
						<div>
							<dt>{t("Cancellation")}</dt>
							<dd>
								{nameOf(deal.cancelAsks[0] ?? "")}{" "}
								{t("asked to cancel; the other side has to agree.")}
							</dd>
						</div>
					)}
				</dl>
				{preferences.expertMode && (
					<p className={styles.muted}>
						{t("Deal contract")}{" "}
						<ExplorerLink target={support.contract()}>{support.contract()}</ExplorerLink>
					</p>
				)}
			</Card>

			<Card title={t("Milestones")}>
				<ol className={styles.list}>
					{deal.milestones.map((m, index) => {
						const due = payoutAt(deal, m);
						return (
							// Milestones are fixed in the terms; their position is their identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<li key={index} className={styles.row}>
								<span className={styles.title}>
									{m.label} · {formatMoney(m.amount, currency)}
								</span>
								<span className={styles.meta}>
									{t(MILESTONE_STATUS_LABELS[m.status])}
									{m.status === "requested" &&
										due !== null &&
										(due > now
											? ` · automatic payout on ${formatDateTime(due)} (${formatRelative(due, now)})`
											: t(" · due for payout"))}
								</span>
							</li>
						);
					})}
				</ol>
			</Card>

			{pending.length > 0 && (
				<Card title={t("Awaiting internal approval")}>
					<ul className={styles.list}>
						{pending.map((r) => (
							<li key={r.id} className={styles.row}>
								<Link to={`/app/approvals/${r.id}`} className={styles.title}>
									{requestTitle(account, r, personName)}
								</Link>
								<span className={styles.meta}>
									{r.status === "scheduled"
										? t("Approved; objection window running")
										: t("Approval requested")}
								</span>
							</li>
						))}
					</ul>
				</Card>
			)}

			<Card title={t("What you can do")}>
				{stepsFor(deal, side, now).length === 0 ? (
					<p className={styles.muted}>{t("Nothing for you to do right now.")}</p>
				) : (
					<div className={styles.actions}>
						{stepsFor(deal, side, now).map((step) => (
							<button
								key={JSON.stringify(step.action)}
								type="button"
								className={buttonClass(
									step.action.type === "object" ||
										step.action.type === "cancel" ||
										step.action.type === "dispute"
										? "secondary"
										: "primary",
								)}
								disabled={busy}
								onClick={() => take(step)}
							>
								{describeDealAction(step.action, label)}
							</button>
						))}
					</div>
				)}
				<p className={styles.muted}>
					{t("Each step goes through your organization's approval rules, like a payment.")}
				</p>
			</Card>
		</>
	);
}
