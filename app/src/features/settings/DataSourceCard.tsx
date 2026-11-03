import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import type { DataSourceKind } from "../../domain/dataSource.ts";
import { Card } from "../../ui/Card.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { useT } from "../../ui/useLanguage.ts";
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
	const t = useT();
	const { dataSource, sourceStatus, preferences, updatePreferences } = useWorkspace();
	const siteDefault = sourceStatus.demoMode === "testnet" ? t("Stellar testnet") : t("sample data");
	return (
		<div id="data-source">
			<Card title={t("Data source")}>
				{testnetConfig && (
					<Segmented<SourcePreference>
						label={t("Data source")}
						value={preferences.dataSource}
						onChange={(dataSource) => updatePreferences({ dataSource, activeOrgId: null })}
						options={[
							{ value: "auto", label: t("Site default ({mode})", { mode: t(siteDefault) }) },
							{ value: "sample", label: t("Sample data") },
							{ value: "testnet", label: t("Stellar testnet") },
						]}
					/>
				)}
				<p>{descriptions[dataSource.kind]}</p>
				{sourceStatus.fallbackReason && (
					<p>
						{sourceStatus.fallbackReason} {t("Sample data is shown until it answers again.")}
					</p>
				)}
			</Card>
		</div>
	);
}
