import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { Page } from "../../ui/Page.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { LogoCard } from "./LogoCard.tsx";
import { RegistryNameCard } from "./RegistryNameCard.tsx";
import styles from "./SettingsPage.module.css";
import { TestnetDeployments } from "./TestnetDeployments.tsx";

/** Everything about the organization being viewed. Personal settings live on the person's pass. */
export function SettingsPage() {
	const { preferences } = useWorkspace();

	return (
		<Page
			title="Organization settings"
			lead={
				<>
					For the organization you're viewing. Your own profile, theme and data source are on{" "}
					<Link to="/app/me">your pass</Link>.
				</>
			}
		>
			<OrgRequired>
				{(account) => (
					<>
						<LogoCard key={account.org.id} account={account} />
						<RegistryNameCard key={`registry-${account.org.id}`} account={account} />
						<OnStellarCard account={account} />
					</>
				)}
			</OrgRequired>
			{preferences.expertMode && <TestnetDeployments />}
		</Page>
	);
}

function OnStellarCard({ account }: { account: OrgAccount }) {
	if (!account.onchain) {
		return (
			<Card title="On Stellar">
				<p className={styles.muted}>
					This is a sample organization; nothing about it is on Stellar. Switch to the testnet on
					your pass to create a real one.
				</p>
			</Card>
		);
	}
	return (
		<Card title="On Stellar">
			<dl className={styles.facts}>
				<div>
					<dt>Organization contract</dt>
					<dd>
						<code className={styles.code}>{account.onchain.contractId}</code>
						<ExplorerLink target={account.onchain.contractId}>View on Stellar</ExplorerLink>
					</dd>
				</div>
				<div>
					<dt>Setup phase</dt>
					<dd>
						{account.onchain.setupPhase
							? "On: the founder can still change people and rules directly."
							: "Over: changes to people and rules need approval like any request."}
					</dd>
				</div>
				<div>
					<dt>Accepted assets</dt>
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
					<dt>Rules document</dt>
					<dd>
						<code className={styles.code}>{account.onchain.policyHash}</code>
						<Link to="/app/rules">Verify on the Rules page</Link>
					</dd>
				</div>
			</dl>
			<p className={styles.muted}>
				The contract holds the money, knows its members by their ancora ID and enforces the rules
				itself. ancora's operator deploys it and sponsors fees, but holds no role in it.
			</p>
		</Card>
	);
}
