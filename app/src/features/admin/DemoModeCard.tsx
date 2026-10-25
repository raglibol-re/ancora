import { useState } from "react";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { Segmented } from "../../ui/Segmented.tsx";
import type { DemoMode } from "../workspace/resolveDataSource.ts";
import { type AdminHealth, setDemoMode } from "./adminApi.ts";
import styles from "./HealthPanel.module.css";

type DemoModeCardProps = {
	passphrase: string;
	demo: AdminHealth["demo"];
	onChange: (demo: AdminHealth["demo"]) => void;
};

/** The site-wide default data source. Everyone who opens ancora without their own choice gets it. */
export function DemoModeCard({ passphrase, demo, onChange }: DemoModeCardProps) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const change = async (mode: DemoMode) => {
		setBusy(true);
		try {
			onChange((await setDemoMode(passphrase, mode)).demo);
			setError(null);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Couldn't change the demo mode.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card title="Demo mode (site-wide default)">
			<fieldset className={styles.plainFieldset} disabled={busy}>
				<Segmented<DemoMode>
					label="Demo mode"
					value={demo.mode}
					onChange={change}
					options={[
						{ value: "sample", label: "Sample data" },
						{ value: "testnet", label: "Stellar testnet" },
					]}
				/>
			</fieldset>
			<p className={styles.muted}>
				"Stellar testnet" falls back to sample data automatically when the testnet or this server
				doesn't answer. People can still pick a source themselves in Settings.
				{demo.updatedAt && ` Last changed ${formatDateTime(Date.parse(demo.updatedAt))}.`}
			</p>
			{error && (
				<p className={styles.bad} role="alert">
					{error}
				</p>
			)}
		</Card>
	);
}
