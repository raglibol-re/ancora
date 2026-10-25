import { useEffect, useState } from "react";
import { canonicalJson } from "../../../shared/policyDocument.ts";
import type { OrgAccount } from "../../domain/account.ts";
import { buildPolicyDocument, rulesHash } from "../../domain/rules/policyDocument.ts";
import { Card } from "../../ui/Card.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./RulesHashCard.module.css";

/**
 * The rules as one readable document with its SHA-256. On testnet the organization contract
 * stores the same hash, so anyone can verify the active rules match what they read here.
 */
export function RulesHashCard({ account }: { account: OrgAccount }) {
	const { preferences } = useWorkspace();
	const [local, setLocal] = useState<string | null>(null);
	const { templateId, roles, policy } = account.org;
	const onchainHash = account.onchain?.policyHash ?? null;

	useEffect(() => {
		let cancelled = false;
		void rulesHash(templateId, roles, policy).then((hash) => {
			if (!cancelled) setLocal(hash);
		});
		return () => {
			cancelled = true;
		};
	}, [templateId, roles, policy]);

	const verified = onchainHash !== null && local !== null ? onchainHash === local : null;
	return (
		<Card
			title="Rules document"
			action={
				verified === null ? null : (
					<span className={verified ? styles.ok : styles.bad}>
						{verified ? "Matches the contract" : "Does not match the contract"}
					</span>
				)
			}
		>
			<p className={styles.muted}>
				The rules above are one readable document. Its fingerprint (SHA-256) is{" "}
				{onchainHash ? "stored in the organization's contract" : "shown here"}, so anyone can check
				that the active rules are exactly these.
			</p>
			<code className={styles.hash}>{local ?? "computing…"}</code>
			{preferences.expertMode && (
				<pre className={styles.document}>
					{canonicalJson(buildPolicyDocument(templateId, roles, policy))}
				</pre>
			)}
		</Card>
	);
}
