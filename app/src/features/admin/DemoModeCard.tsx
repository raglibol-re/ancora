import { Card } from "../../ui/Card.tsx";
import type { AdminHealth } from "./adminApi.ts";
import styles from "./HealthPanel.module.css";

const LABELS = { sample: "Sample data", testnet: "Stellar testnet" } as const;

/**
 * The site-wide default data source: what everyone gets who opens ancora without their own
 * choice. A setting of the deployment, shown here so the operator sees what visitors get.
 */
export function DemoModeCard({ demo }: { demo: AdminHealth["demo"] }) {
	return (
		<Card title="Demo mode (site-wide default)">
			<p>
				Visitors get: <strong>{LABELS[demo.mode]}</strong>
			</p>
			<p className={styles.muted}>
				"Stellar testnet" falls back to sample data automatically when the testnet or this server
				doesn't answer. People can still pick a source themselves in Settings. To change the
				default, set <code>DEFAULT_DATA_SOURCE</code> (sample or testnet) in the Vercel project and
				redeploy.
			</p>
		</Card>
	);
}
