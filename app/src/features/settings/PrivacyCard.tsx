import type { OrgAccount } from "../../domain/account.ts";
import type { Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AuditorsSection } from "./AuditorsSection.tsx";
import styles from "./SettingsPage.module.css";
import { usePrivacyStatus } from "./usePrivacyStatus.ts";

/**
 * Private details: payment references and discussion entries stored on Stellar encrypted, so
 * only the organization's members read them. Amounts and who is paid stay public.
 */
export function PrivacyCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.privacy;
	const { status, error, load } = usePrivacyStatus(account.org.id);

	if (!support || !account.onchain) return null;
	const names = (ids: readonly string[]) => ids.map(personName).join(", ");

	const step = async <T,>(
		title: string,
		action: () => Promise<Result<T, RuleError>>,
		success: string,
	) => {
		const result = await run(action, { signature: { kind: "passkey", title }, success });
		if (result?.ok) load();
	};

	return (
		<Card title={t("Private details")}>
			<p className={styles.muted}>
				{t(
					"Payment references and discussion entries can be stored on Stellar encrypted, so only your organization's members read them. Amounts and who you pay stay visible on the public network. Each person's key stays on their device; a new device gets access when another member shares it.",
				)}
			</p>
			{error && <p className={styles.warn}>{error}</p>}
			{status && (
				<dl className={styles.facts}>
					<div>
						<dt>{t("References and discussions")}</dt>
						<dd>
							{status.epoch === 0
								? t("Readable by anyone on the network")
								: `Private (key ${status.epoch})${status.canRead ? "" : t(" · not readable on this device yet")}`}
						</dd>
					</div>
					<div>
						<dt>{t("This device")}</dt>
						<dd>{status.deviceReady ? t("Set up") : t("Not set up")}</dd>
					</div>
					{status.withoutKey.length > 0 && (
						<div>
							<dt>{t("Not set up yet")}</dt>
							<dd>{names(status.withoutKey)}</dd>
						</div>
					)}
					{status.waiting.length > 0 && (
						<div>
							<dt>{t("Waiting for access")}</dt>
							<dd>{names(status.waiting)}</dd>
						</div>
					)}
				</dl>
			)}
			{status && (
				<div className={styles.actions}>
					{!status.deviceReady && (
						<button
							type="button"
							className={buttonClass()}
							disabled={busy}
							onClick={() =>
								step(
									"Set up private details on this device",
									() => support.setUpDevice(me.id),
									"This device is set up. Members can now share access with you.",
								)
							}
						>
							{t("Set up this device")}
						</button>
					)}
					{status.deviceReady && status.epoch === 0 && (
						<button
							type="button"
							className={buttonClass()}
							disabled={busy}
							onClick={() =>
								step(
									"Make references and discussions private",
									() => support.newEpoch(account.org.id, me.id),
									"Private from now on. Members who set up a device later get access when shared.",
								)
							}
						>
							{t("Make details private")}
						</button>
					)}
					{status.canRead && status.waiting.length > 0 && (
						<button
							type="button"
							className={buttonClass()}
							disabled={busy}
							onClick={() =>
								step(
									"Share access to private details",
									() => support.shareWaiting(account.org.id, me.id),
									"Access shared.",
								)
							}
						>
							{t("Share access with")} {status.waiting.length}
						</button>
					)}
					{status.canRead && status.epoch > 0 && (
						<button
							type="button"
							className={buttonClass("secondary")}
							disabled={busy}
							onClick={() =>
								step(
									"Renew the organization's key",
									() => support.newEpoch(account.org.id, me.id),
									"New key shared with every set-up member. Anyone who left can't read what comes next.",
								)
							}
						>
							{t("Renew the key (after someone leaves)")}
						</button>
					)}
				</div>
			)}
			{status && status.epoch > 0 && (
				<AuditorsSection
					support={support}
					orgId={account.org.id}
					auditors={status.auditors}
					onChanged={load}
				/>
			)}
		</Card>
	);
}
