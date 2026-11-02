import { StrKey } from "@stellar/stellar-sdk";
import { type FormEvent, useState } from "react";
import { shortAddress } from "../../domain/account.ts";
import type { PrivacySupport } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SettingsPage.module.css";

type Props = {
	support: PrivacySupport;
	orgId: string;
	auditors: readonly string[];
	onChanged: () => void;
};

/**
 * People outside the organization (an accountant, a funder's reviewer) who may read its private
 * details on their own audit page. Any member adds or removes one; everyone sees who.
 */
export function AuditorsSection({ support, orgId, auditors, onChanged }: Props) {
	const { me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);

	const add = async (event: FormEvent) => {
		event.preventDefault();
		const auditor = input.trim();
		if (!StrKey.isValidContract(auditor) && !StrKey.isValidEd25519PublicKey(auditor)) {
			setError("Enter the auditor's ancora ID or Stellar address (starts with C or G).");
			return;
		}
		setError(null);
		const result = await run(() => support.addAuditor(orgId, me.id, auditor), {
			signature: { kind: "passkey", title: "Add an auditor" },
			success: "Auditor added. Once they set up their device, share access with them.",
		});
		if (result?.ok) {
			setInput("");
			onChanged();
		}
	};

	const remove = async (auditor: string) => {
		const result = await run(() => support.removeAuditor(orgId, me.id, auditor), {
			signature: { kind: "passkey", title: "Remove an auditor" },
			success: "Auditor removed. Renew the key so they can't read what comes next.",
		});
		if (result?.ok) onChanged();
	};

	return (
		<div className={styles.form}>
			<p className={styles.muted}>
				Auditors read your private details on their own audit page (ancora → Audit) once access is
				shared with them. They can't change anything.
			</p>
			{auditors.map((auditor) => (
				<div key={auditor} className={styles.actions}>
					<span>{personName(auditor) || shortAddress(auditor)}</span>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => remove(auditor)}
					>
						Remove
					</button>
				</div>
			))}
			<form className={styles.form} onSubmit={add} noValidate>
				<Field label="Add an auditor" htmlFor="auditor" error={error}>
					<input
						id="auditor"
						className={controlClass}
						placeholder="Their ancora ID (C…)"
						spellCheck={false}
						value={input}
						onChange={(e) => setInput(e.target.value)}
					/>
				</Field>
				<button type="submit" className={buttonClass("secondary")} disabled={busy}>
					Add auditor
				</button>
			</form>
		</div>
	);
}
