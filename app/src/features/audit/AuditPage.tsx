import { StrKey } from "@stellar/stellar-sdk";
import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AuditedOrganization } from "./AuditedOrganization.tsx";
import styles from "./AuditPage.module.css";

/**
 * Read-only view for an auditor: an organization's requests and saved recipients, with the
 * private details its members shared with this person opened. Nothing here can change anything.
 */
export function AuditPage() {
	const t = useT();
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.privacy;
	const [orgId, setOrgId] = useState("");
	const [account, setAccount] = useState<OrgAccount | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (!support) {
		return (
			<Page title={t("Audit")}>
				<Card>
					<p className={styles.muted}>
						{t("Audits run on the Stellar testnet. Sign in with your pass there.")}
					</p>
				</Card>
			</Page>
		);
	}

	const open = async (event: FormEvent) => {
		event.preventDefault();
		const id = orgId.trim();
		if (!StrKey.isValidContract(id)) {
			setError(t("Enter the organization's account address (starts with C)."));
			return;
		}
		setError(null);
		const result = await run(() => support.audit(id, me.id));
		if (result?.ok) setAccount(result.value);
	};

	return (
		<Page
			title={t("Audit")}
			lead={t(
				"Read an organization's requests and recipients as its auditor. Its members add you and share access; you can't change anything.",
			)}
		>
			<Card title={t("Your part")}>
				<p className={styles.muted}>
					{t("Give the organization your ancora ID,")} <code className={styles.code}>{me.id}</code>
					{t(", and set up this device so they can share their key with you.")}
				</p>
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy}
					onClick={() =>
						run(() => support.setUpDevice(me.id), {
							signature: { kind: "passkey", title: t("Set up private details on this device") },
							success: t("This device is set up. The organization can now share access with you."),
						})
					}
				>
					{t("Set up this device")}
				</button>
			</Card>
			<Card title={t("Open an organization")}>
				<form className={styles.form} onSubmit={open} noValidate>
					<Field label={t("Organization address")} htmlFor="audit-org" error={error}>
						<input
							id="audit-org"
							className={controlClass}
							placeholder="C…"
							spellCheck={false}
							value={orgId}
							onChange={(e) => setOrgId(e.target.value)}
						/>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy}>
						{t("Open read-only")}
					</button>
				</form>
			</Card>
			{account && <AuditedOrganization account={account} />}
		</Page>
	);
}
