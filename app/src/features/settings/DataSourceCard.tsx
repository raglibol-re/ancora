import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import type { DataSourceKind } from "../../domain/dataSource.ts";
import { Card } from "../../ui/Card.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

const descriptions: Record<DataSourceKind, string> = {
	sample:
		"Sample data: realistic organizations that behave like the real thing, stored in this browser. Nothing is sent to the Stellar testnet.",
	testnet:
		"Stellar testnet: organization accounts are real smart accounts secured by passkeys on this device, fees are sponsored, balances and payments are real test USDC. Approval rules run in the app until they move on-chain.",
};

/** Choose between sample data and the Stellar testnet. The demo admin takes this over in task 5. */
export function DataSourceCard() {
	const { dataSource, updatePreferences } = useWorkspace();
	return (
		<div id="data-source">
			<Card title="Data source">
				{testnetConfig && (
					<Segmented<DataSourceKind>
						label="Data source"
						value={dataSource.kind}
						onChange={(kind) => updatePreferences({ dataSource: kind, activeOrgId: null })}
						options={[
							{ value: "sample", label: "Sample data" },
							{ value: "testnet", label: "Stellar testnet" },
						]}
					/>
				)}
				<p>{descriptions[dataSource.kind]}</p>
			</Card>
		</div>
	);
}
