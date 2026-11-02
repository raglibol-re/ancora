import { StrKey } from "@stellar/stellar-sdk";
import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { AuditedOrganization } from "./AuditedOrganization.tsx";
import styles from "./AuditPage.module.css";

/**
 * Read-only view for an auditor: an organization's requests and saved recipients, with the
 * private details its members shared with this person opened. Nothing here can change anything.
 */
export function AuditPage() {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.privacy;
	const [orgId, setOrgId] = useState("");
	const [account, setAccount] = useState<OrgAccount | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (!support) {
		return (
			<Page title="Audit">
				<Card>
					<p className={styles.muted}>
						Audits run on the Stellar testnet. Sign in with your pass there.
					</p>
				</Card>
			</Page>
		);
	}

	const open = async (event: FormEvent) => {
		event.preventDefault();
		const id = orgId.trim();
		if (!StrKey.isValidContract(id)) {
			setError("Enter the organization's account address (starts with C).");
			return;
		}
		setError(null);
		const result = await run(() => support.audit(id, me.id));
		if (result?.ok) setAccount(result.value);
	};

	return (
		<Page
			title="Audit"
			lead="Read an organization's requests and recipients as its auditor. Its members add you and share access; you can't change anything."
		>
			<Card title="Your part">
				<p className={styles.muted}>
					Give the organization your ancora ID, <code className={styles.code}>{me.id}</code>, and
					set up this device so they can share their key with you.
				</p>
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy}
					onClick={() =>
						run(() => support.setUpDevice(me.id), {
							signature: { kind: "passkey", title: "Set up private details on this device" },
							success: "This device is set up. The organization can now share access with you.",
						})
					}
				>
					Set up this device
				</button>
			</Card>
			<Card title="Open an organization">
				<form className={styles.form} onSubmit={open} noValidate>
					<Field label="Organization address" htmlFor="audit-org" error={error}>
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
						Open read-only
					</button>
				</form>
			</Card>
			{account && <AuditedOrganization account={account} />}
		</Page>
	);
}
