import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { shortAddress } from "../../domain/account.ts";
import type { EscrowView } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./EscrowPage.module.css";

/**
 * The recipient's side of a secure handover: the organization approved and funded a payment,
 * and it goes out once the recipient and the organization both confirm. Reached by the link the
 * sender shares; the recipient needs no membership, only their own pass.
 */
export function EscrowPage() {
	const t = useT();
	const { orgId = "", requestId = "" } = useParams();
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const [view, setView] = useState<EscrowView | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result.
	const latest = useRef(0);

	const load = useCallback(() => {
		const request = ++latest.current;
		void dataSource.escrowOf(orgId, requestId).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) setView(result.value);
			else setError(result.error.message);
		});
	}, [dataSource, orgId, requestId]);

	useEffect(() => {
		load();
		return () => {
			latest.current += 1;
		};
	}, [load]);

	const confirm = async () => {
		const result = await run(() => dataSource.confirmEscrow(orgId, requestId, me.id), {
			signature: { kind: "passkey", title: t("Confirm the secure handover") },
			success: t("Confirmed. The money goes out as soon as the organization confirms too."),
		});
		if (result?.ok) load();
	};

	const request = view?.request ?? null;
	const confirmed = request?.escrowConfirmed ?? null;
	const forMe = request?.recipientId === me.id;

	return (
		<Page title={t("Secure handover")}>
			{error && (
				<Card title={t("Not found")}>
					<p>{t(error)}</p>
					<Link to="/app">{t("Back to the overview")}</Link>
				</Card>
			)}
			{view && request && (
				<Card
					title={t("{amount} from {organization}", {
						amount: formatMoney(request.amount, view.currency),
						organization: view.orgName,
					})}
					action={dataSource.kind === "sample" ? <SimulatedTag /> : null}
				>
					<p className={styles.muted}>
						{t(
							"{organization} approved this payment on {date} and set the money aside. It is paid out once both sides confirm: you, the recipient, and the organization.",
							{ organization: view.orgName, date: formatDateTime(request.createdAt) },
						)}
					</p>
					{request.note && <p className={styles.note}>“{request.note}”</p>}
					<dl className={styles.facts}>
						<div>
							<dt>{t("Recipient")}</dt>
							<dd>
								{shortAddress(request.recipientId)}
								{forMe ? " (you)" : ""}
							</dd>
						</div>
						<div>
							<dt>{t("Recipient confirmed")}</dt>
							<dd>{confirmed?.recipient ? "Yes" : t("Not yet")}</dd>
						</div>
						<div>
							<dt>{t("Organization confirmed")}</dt>
							<dd>{confirmed?.sender ? "Yes" : t("Not yet")}</dd>
						</div>
						<div>
							<dt>{t("Status")}</dt>
							<dd>
								{request.status === "executed"
									? t("Paid out")
									: request.status === "escrowed"
										? "Held"
										: request.status}
							</dd>
						</div>
					</dl>
					{request.status === "escrowed" && forMe && !confirmed?.recipient && (
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={confirm}>
								{t("Confirm: I'm the recipient and the terms are right")}
							</button>
						</div>
					)}
					{request.status === "escrowed" && !forMe && (
						<p className={styles.muted}>
							{t("Only the recipient's pass (")}
							{shortAddress(request.recipientId)}
							{t(") can confirm here. Open this link signed in with that pass.")}
						</p>
					)}
				</Card>
			)}
		</Page>
	);
}
