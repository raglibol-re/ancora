import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { usePrivacyStatus } from "../settings/usePrivacyStatus.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./OverviewPage.module.css";

/**
 * Nudges a member who can read the private details when someone (a new member, a new device,
 * an auditor) has set up and is still waiting for the key. Only this device can hand it over.
 */
export function AccessReminder({ account }: { account: OrgAccount }) {
	const t = useT();
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.privacy;
	const { status, load } = usePrivacyStatus(account.org.id);

	if (!support || !account.onchain || !status?.canRead || status.waiting.length === 0) return null;

	const share = async () => {
		const result = await run(() => support.shareWaiting(account.org.id, me.id), {
			signature: { kind: "passkey", title: t("Share access to private details") },
			success: t("Access shared."),
		});
		if (result?.ok) load();
	};

	return (
		<Card title={t("Waiting for access")}>
			<p className={styles.sub}>
				{status.waiting.map(personName).join(", ")} {status.waiting.length === 1 ? "has" : "have"}{" "}
				{t(
					"set up and can't read your private references yet. Your device can share the key with them.",
				)}
			</p>
			<div className={styles.actions}>
				<button type="button" className={buttonClass()} disabled={busy} onClick={share}>
					{t("Share access")}
				</button>
			</div>
		</Card>
	);
}
