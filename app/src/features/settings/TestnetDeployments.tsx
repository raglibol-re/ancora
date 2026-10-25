import { explorerUrl, testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import { Card } from "../../ui/Card.tsx";
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
		["USDC (BlendUSDC)", testnetConfig.usdcToken],
		["Reserve vault (DeFindex)", testnetConfig.defindexVault],
		["Passkey verifier", testnetConfig.webauthnVerifier],
		["Ed25519 verifier", testnetConfig.ed25519Verifier],
		["Threshold policy", testnetConfig.thresholdPolicy],
		["Spending-limit policy", testnetConfig.spendingLimitPolicy],
		["Native XLM token", testnetConfig.nativeToken],
		["Demo operator (not a signer)", testnetConfig.deployerAddress],
	];

	return (
		<Card title="Testnet deployments">
			<dl className={styles.list}>
				{rows.map(([label, address]) => (
					<div key={label} className={styles.row}>
						<dt>{label}</dt>
						<dd>
							<a href={explorerUrl(address)} target="_blank" rel="noreferrer">
								{address}
							</a>
						</dd>
					</div>
				))}
			</dl>
		</Card>
	);
}
