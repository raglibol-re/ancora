import { Link } from "react-router";
import { currencyOf, type OrgAccount, shortAddress } from "../../domain/account.ts";
import { DEAL_STATUS_LABELS, type Deal, sideOf } from "../../domain/deals.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Deals.module.css";
import { NewDealForm } from "./NewDealForm.tsx";
import { useDeals } from "./useDeals.ts";

export function DealsPage() {
	const t = useT();
	return (
		<Page
			title={t("Deals")}
			lead={t(
				"Settle work with another organization step by step: the amount is deposited up front and paid out milestone by milestone, each side under its own approval rules.",
			)}
		>
			<OrgRequired>{(account) => <Deals key={account.org.id} account={account} />}</OrgRequired>
		</Page>
	);
}

function Deals({ account }: { account: OrgAccount }) {
	const t = useT();
	const { deals, error, support, reload } = useDeals(account);

	if (!support) {
		return (
			<Card title={t("Deals")}>
				<p className={styles.muted}>
					{t("Deals run on the Stellar testnet. Switch to the testnet on your pass to start one.")}
				</p>
			</Card>
		);
	}
	if (account.onchain && !account.onchain.controls) {
		return (
			<Card title={t("Deals")}>
				<p className={styles.muted}>
					{t(
						"This organization runs an earlier release. Move to the latest release under Settings → Organization code to start deals (organizations from before 1 Nov 2026 can't).",
					)}
				</p>
			</Card>
		);
	}

	return (
		<>
			<NewDealForm account={account} onCreated={reload} />
			<Card title={t("Your deals")}>
				{error && <p className={styles.error}>{error}</p>}
				{deals === null ? (
					<p className={styles.muted}>{t("Reading your deals…")}</p>
				) : deals.length === 0 ? (
					<p className={styles.muted}>{t("No deals yet. Propose one above.")}</p>
				) : (
					<ul className={styles.list}>
						{deals.map((deal) => (
							<DealRow key={deal.id} account={account} deal={deal} />
						))}
					</ul>
				)}
			</Card>
		</>
	);
}

function DealRow({ account, deal }: { account: OrgAccount; deal: Deal }) {
	const t = useT();
	const { myAccounts } = useWorkspace();
	const side = sideOf(deal, account.org.id);
	const other = side === "a" ? deal.partyB : deal.partyA;
	const otherName = myAccounts.find((a) => a.org.id === other)?.org.name ?? shortAddress(other);
	const currency = currencyOf(account, deal.token);
	return (
		<li className={styles.row}>
			<Link to={`/app/deals/${deal.id}`} className={styles.title}>
				{t("Deal #")}
				{deal.id} {side === "a" ? "with" : "from"} {otherName}
			</Link>
			<span className={styles.meta}>
				{formatMoney(deal.total, currency)} · {deal.milestones.length} {t("milestone")}
				{deal.milestones.length === 1 ? "" : "s"} · {DEAL_STATUS_LABELS[deal.status]} {t("· since")}{" "}
				{formatDateTime(deal.createdAt)}
			</span>
		</li>
	);
}
