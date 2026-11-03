import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { LogoCard } from "./LogoCard.tsx";
import { OrgCodeCard } from "./OrgCodeCard.tsx";
import { PrivacyCard } from "./PrivacyCard.tsx";
import { RegistryNameCard } from "./RegistryNameCard.tsx";
import { SealCard } from "./SealCard.tsx";
import styles from "./SettingsPage.module.css";
import { TestnetDeployments } from "./TestnetDeployments.tsx";

/** Everything about the organization being viewed. Personal settings live on the person's pass. */
export function SettingsPage() {
	const t = useT();
	const { preferences } = useWorkspace();

	return (
		<Page
			title={t("Organization settings")}
			lead={
				<>
					{t("For the organization you're viewing. Your own profile, theme and data source are on")}{" "}
					<Link to="/app/me">{t("your pass")}</Link>.
				</>
			}
		>
			<OrgRequired>
				{(account) => (
					<>
						<LogoCard key={account.org.id} account={account} />
						<RegistryNameCard key={`registry-${account.org.id}`} account={account} />
						<OnStellarCard account={account} />
						<OrgCodeCard key={`code-${account.org.id}`} account={account} />
						<SealCard key={`seal-${account.org.id}`} account={account} />
						<PrivacyCard key={`privacy-${account.org.id}`} account={account} />
					</>
				)}
			</OrgRequired>
			{preferences.expertMode && <TestnetDeployments />}
		</Page>
	);
}

function OnStellarCard({ account }: { account: OrgAccount }) {
	const t = useT();
	if (!account.onchain) {
		return (
			<Card title={t("On Stellar")}>
				<p className={styles.muted}>
					{t(
						"This is a sample organization; nothing about it is on Stellar. Switch to the testnet on your pass to create a real one.",
					)}
				</p>
			</Card>
		);
	}
	return (
		<Card title={t("On Stellar")}>
			<dl className={styles.facts}>
				<div>
					<dt>{t("Account address on Stellar")}</dt>
					<dd>
						<code className={styles.code}>{account.onchain.contractId}</code>
						<ExplorerLink target={account.onchain.contractId}>{t("View on Stellar")}</ExplorerLink>
					</dd>
				</div>
				<div>
					<dt>{t("Setup phase")}</dt>
					<dd>
						{account.onchain.setupPhase
							? t("On: the founder can still change people and rules directly.")
							: t("Over: changes to people and rules need approval like any request.")}
					</dd>
				</div>
				<div>
					<dt>{t("Accepted assets")}</dt>
					<dd>
						{account.org.assets.map((asset) => (
							<span key={asset.token}>
								{asset.symbol} ({asset.currency}) ·{" "}
								<code className={styles.code}>{asset.token}</code>
							</span>
						))}
					</dd>
				</div>
				<div>
					<dt>{t("Rules document")}</dt>
					<dd>
						<code className={styles.code}>{account.onchain.policyHash}</code>
						<Link to="/app/rules">{t("Verify on the Rules page")}</Link>
					</dd>
				</div>
			</dl>
			<p className={styles.muted}>
				{t(
					"The contract holds the money, knows its members by their ancora ID and enforces the rules itself. ancora's operator deploys it and sponsors fees, but holds no role in it.",
				)}
			</p>
		</Card>
	);
}
