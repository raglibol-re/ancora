import { listDeployments, testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import styles from "./TestnetDeployments.module.css";

/** Expert mode: the testnet contracts ancora is wired to, verified by scripts/setup-testnet.sh. */
export function TestnetDeployments() {
	if (!testnetConfig) {
		return (
			<Card title="Testnet deployments">
				<p>
					Not configured in this build. Run scripts/setup-testnet.sh to generate app/.env.testnet.
				</p>
			</Card>
		);
	}
	const rows: [string, string][] = [
		...listDeployments(testnetConfig).map((d): [string, string] => [d.label, d.id]),
		["Demo operator (not a signer)", testnetConfig.deployerAddress],
	];

	return (
		<Card title="Testnet deployments">
			<dl className={styles.list}>
				{rows.map(([label, address]) => (
					<div key={label} className={styles.row}>
						<dt>{label}</dt>
						<dd>
							<ExplorerLink target={address}>{address}</ExplorerLink>
						</dd>
					</div>
				))}
			</dl>
		</Card>
	);
}
