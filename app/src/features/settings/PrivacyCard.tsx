import { useCallback, useEffect, useRef, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { PrivacyStatus } from "../../domain/dataSource.ts";
import type { Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SettingsPage.module.css";

/**
 * Private details: payment references and discussion entries stored on Stellar encrypted, so
 * only the organization's members read them. Amounts and who is paid stay public.
 */
export function PrivacyCard({ account }: { account: OrgAccount }) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.privacy;
	const [status, setStatus] = useState<PrivacyStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result.
	const latest = useRef(0);

	const load = useCallback(() => {
		if (!support) return;
		const request = ++latest.current;
		void support.status(account.org.id, me.id).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) setStatus(result.value);
			else setError(result.error.message);
		});
	}, [support, account.org.id, me.id]);

	useEffect(() => {
		load();
		return () => {
			latest.current += 1;
		};
	}, [load]);

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
		<Card title="Private details">
			<p className={styles.muted}>
				Payment references and discussion entries can be stored on Stellar encrypted, so only your
				organization's members read them. Amounts and who you pay stay visible on the public
				network. Each person's key stays on their device; a new device gets access when another
				member shares it.
			</p>
			{error && <p className={styles.warn}>{error}</p>}
			{status && (
				<dl className={styles.facts}>
					<div>
						<dt>References and discussions</dt>
						<dd>
							{status.epoch === 0
								? "Readable by anyone on the network"
								: `Private (key ${status.epoch})${status.canRead ? "" : " · not readable on this device yet"}`}
						</dd>
					</div>
					<div>
						<dt>This device</dt>
						<dd>{status.deviceReady ? "Set up" : "Not set up"}</dd>
					</div>
					{status.withoutKey.length > 0 && (
						<div>
							<dt>Not set up yet</dt>
							<dd>{names(status.withoutKey)}</dd>
						</div>
					)}
					{status.waiting.length > 0 && (
						<div>
							<dt>Waiting for access</dt>
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
							Set up this device
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
							Make details private
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
							Share access with {status.waiting.length}
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
							Renew the key (after someone leaves)
						</button>
					)}
				</div>
			)}
		</Card>
	);
}
