import { useEffect, useState } from "react";
import { canonicalJson } from "../../../shared/policyDocument.ts";
import type { OrgAccount } from "../../domain/account.ts";
import {
	buildPolicyDocument,
	legacyRulesHash,
	rulesHash,
} from "../../domain/rules/policyDocument.ts";
import { Card } from "../../ui/Card.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./RulesHashCard.module.css";

type Verdict = { matches: boolean; version: 3 | 2 | null };

/**
 * The rules as one readable document with its SHA-256. On testnet the organization contract
 * stores the same hash, so anyone can verify the active rules match what they read here.
 * Organizations created before 26 Oct 2026 hashed the previous document version.
 */
export function RulesHashCard({ account }: { account: OrgAccount }) {
	const { preferences } = useWorkspace();
	const [local, setLocal] = useState<string | null>(null);
	const [verdict, setVerdict] = useState<Verdict | null>(null);
	const { templateId, roles, policy, baseCurrency } = account.org;
	const onchainHash = account.onchain?.policyHash ?? null;

	useEffect(() => {
		let cancelled = false;
		void Promise.all([
			rulesHash(templateId, roles, policy, baseCurrency),
			legacyRulesHash(templateId, roles, policy, baseCurrency),
		]).then(([current, legacy]) => {
			if (cancelled) return;
			setLocal(current);
			if (onchainHash === null) setVerdict(null);
			else if (onchainHash === current) setVerdict({ matches: true, version: 3 });
			else if (onchainHash === legacy) setVerdict({ matches: true, version: 2 });
			else setVerdict({ matches: false, version: null });
		});
		return () => {
			cancelled = true;
		};
	}, [templateId, roles, policy, baseCurrency, onchainHash]);

	return (
		<Card
			title="Rules document"
			action={
				verdict === null ? null : (
					<span className={verdict.matches ? styles.ok : styles.bad}>
						{verdict.matches
							? `Active: v${verdict.version} (matches the contract)`
							: "Does not match the contract"}
					</span>
				)
			}
		>
			<p className={styles.muted}>
				The rules above are one readable document. Its fingerprint (SHA-256) is{" "}
				{onchainHash ? "stored in the organization's contract" : "shown here"}, so anyone can check
				that the active rules are exactly these.
				{verdict?.version === 2 &&
					" This organization's active document is version 2; its next approved rule change is written as version 3."}
				{preferences.expertMode &&
					" Version 3 is canonical JSON in the style of stellar-registry/perch (sorted keys, no whitespace, amounts as decimal strings)."}
			</p>
			<code className={styles.hash}>{local ?? "computing…"}</code>
			{preferences.expertMode && (
				<pre className={styles.document}>
					{canonicalJson(buildPolicyDocument(templateId, roles, policy, baseCurrency))}
				</pre>
			)}
		</Card>
	);
}
