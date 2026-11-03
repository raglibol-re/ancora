import { useCallback, useEffect, useRef, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { CodeStatus } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useProposeChange } from "../rules/useProposeChange.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SettingsPage.module.css";

/**
 * The code the organization's contract runs, next to the latest ancora release on the Stellar
 * Registry. Moving to a new release is a change like any other: the members approve it under
 * the organization's rules, and the contract only accepts the release the registry names.
 */
export function OrgCodeCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const { dataSource } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const support = dataSource.releases;
	const [status, setStatus] = useState<CodeStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result.
	const latest = useRef(0);

	const load = useCallback(() => {
		if (!support) return;
		const request = ++latest.current;
		void support.status(account.org.id).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) setStatus(result.value);
			else setError(result.error.message);
		});
	}, [support, account.org.id]);

	useEffect(() => {
		load();
		return () => {
			latest.current += 1;
		};
	}, [load]);

	if (!support || !account.onchain) return null;
	const release = status?.latest ?? null;
	const upToDate = release !== null && status?.running === release.wasmHash;

	const upgrade = async () => {
		if (!release) return;
		const result = await propose({
			type: "upgrade",
			wasmHash: release.wasmHash,
			version: release.version,
		});
		if (result?.ok) load();
	};

	return (
		<Card title={t("Organization code")}>
			<p className={styles.muted}>
				{t(
					"ancora publishes every version of the organization's code on the Stellar Registry, where anyone can compare it with what this contract runs. Nobody can change the code for you: a move to a new release is a change the members approve under your rules.",
				)}
			</p>
			{error && <p className={styles.warn}>{t(error)}</p>}
			{status && (
				<dl className={styles.facts}>
					<div>
						<dt>{t("Runs")}</dt>
						<dd>
							{upToDate
								? t("ancora release {version}, the latest", { version: release.version })
								: t("Code")}
							<code className={styles.code}>{status.running}</code>
						</dd>
					</div>
					<div>
						<dt>{t("Latest release")}</dt>
						<dd>
							{release ? (
								<>
									{t("ancora-organization")} {release.version}
									<code className={styles.code}>{release.wasmHash}</code>
								</>
							) : (
								"Nothing published on the registry yet."
							)}
							<ExplorerLink target={support.registry()}>{t("Registry on Stellar")}</ExplorerLink>
						</dd>
					</div>
				</dl>
			)}
			{release && !upToDate && account.onchain.upgrades && (
				<div className={styles.actions}>
					<span className={styles.muted}>
						{account.onchain.setupPhase
							? t("During the setup phase the founder moves to it directly.")
							: t("Moving to it becomes a request that follows your rules for changes.")}
					</span>
					<button type="button" className={buttonClass()} disabled={busy} onClick={upgrade}>
						{t("Move to release")} {release.version}
					</button>
				</div>
			)}
			{release && !upToDate && !account.onchain.upgrades && (
				<p className={styles.muted}>
					{t(
						"This organization was created before organizations could move to new releases, so its code stays as it is. Organizations created from 1 Nov 2026 can.",
					)}
				</p>
			)}
		</Card>
	);
}
