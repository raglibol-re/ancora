import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import type { DataSourceKind } from "../../domain/dataSource.ts";
import { Card } from "../../ui/Card.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import type { SourcePreference } from "../workspace/resolveDataSource.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

const descriptions: Record<DataSourceKind, string> = {
	sample:
		"Sample data: realistic organizations that behave like the real thing, stored in this browser. Nothing is sent to the Stellar testnet.",
	testnet:
		"Stellar testnet: you are a passkey-secured account on Stellar, each organization is its own contract that holds real test USDC and enforces the approval rules on-chain, and fees are sponsored.",
};

/** Follow the site default (set by the demo admin) or force sample data / the Stellar testnet. */
export function DataSourceCard() {
	const { dataSource, sourceStatus, preferences, updatePreferences } = useWorkspace();
	const siteDefault = sourceStatus.demoMode === "testnet" ? "Stellar testnet" : "sample data";
	return (
		<div id="data-source">
			<Card title="Data source">
				{testnetConfig && (
					<Segmented<SourcePreference>
						label="Data source"
						value={preferences.dataSource}
						onChange={(dataSource) => updatePreferences({ dataSource, activeOrgId: null })}
						options={[
							{ value: "auto", label: `Site default (${siteDefault})` },
							{ value: "sample", label: "Sample data" },
							{ value: "testnet", label: "Stellar testnet" },
						]}
					/>
				)}
				<p>{descriptions[dataSource.kind]}</p>
				{sourceStatus.fallbackReason && (
					<p>{sourceStatus.fallbackReason} Sample data is shown until it answers again.</p>
				)}
			</Card>
		</div>
	);
}
