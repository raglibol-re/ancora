import { useMemo } from "react";
import { type OrgAccount, shortAddress } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { statementNames } from "../activity/statementNames.ts";
import { downloadStatement } from "../overview/downloadStatement.ts";
import { usePotItems } from "../pot/usePotItems.ts";
import { requestTitle, statusLabels } from "../requests/describe.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AuditPage.module.css";

/**
 * An organization as its auditor reads it: requests, recipients, and a statement that includes
 * the confidential pot's private payments when access to the pot key was shared.
 */
export function AuditedOrganization({ account }: { account: OrgAccount }) {
	const t = useT();
	const { personName } = useWorkspace();
	const names = useMemo(() => statementNames(account, personName), [account, personName]);
	const pot = usePotItems(account, names.payee);
	const nameOf = (id: string) =>
		account.payees.find((p) => p.account === id)?.name ?? shortAddress(id);

	return (
		<Card
			title={account.org.name}
			action={
				<button
					type="button"
					className={buttonClass("secondary")}
					onClick={() => downloadStatement(account, personName, pot)}
				>
					{t("Download statement (CSV)")}
				</button>
			}
		>
			<h3 className={styles.heading}>{t("Requests")}</h3>
			<ul className={styles.list}>
				{account.requests.map((request) => (
					<li key={request.id} className={styles.row}>
						<span className={styles.title}>{requestTitle(account, request, nameOf)}</span>
						<span className={styles.meta}>
							{formatDateTime(request.createdAt)} · {t(statusLabels[request.status])}
							{(request.kind === "payment" || request.kind === "batch") && request.note
								? ` · ${request.note}`
								: ""}
						</span>
					</li>
				))}
			</ul>
			<h3 className={styles.heading}>{t("Recipients")}</h3>
			<ul className={styles.list}>
				{account.payees.map((payee) => (
					<li key={payee.id} className={styles.row}>
						<span className={styles.title}>{payee.name}</span>
						<span className={styles.meta}>
							{shortAddress(payee.account)}
							{payee.note ? ` · ${payee.note}` : ""}
						</span>
					</li>
				))}
			</ul>
			{pot.length > 0 && (
				<p className={styles.muted}>
					{pot.length === 1
						? t(
								"Confidential pot: 1 private payment is in the statement, read with the pot key shared with you.",
							)
						: t(
								"Confidential pot: {count} private payments are in the statement, read with the pot key shared with you.",
								{ count: pot.length },
							)}
				</p>
			)}
		</Card>
	);
}
