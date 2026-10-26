import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { shortAddress } from "../../domain/account.ts";
import type { EscrowView } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./EscrowPage.module.css";

/**
 * The recipient's side of a secure handover: the organization approved and funded a payment,
 * and it goes out once the recipient and the organization both confirm. Reached by the link the
 * sender shares; the recipient needs no membership, only their own pass.
 */
export function EscrowPage() {
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
			signature: { kind: "passkey", title: "Confirm the secure handover" },
			success: "Confirmed. The money goes out as soon as the organization confirms too.",
		});
		if (result?.ok) load();
	};

	const request = view?.request ?? null;
	const confirmed = request?.escrowConfirmed ?? null;
	const forMe = request?.recipientId === me.id;

	return (
		<Page title="Secure handover">
			{error && (
				<Card title="Not found">
					<p>{error}</p>
					<Link to="/app">Back to the overview</Link>
				</Card>
			)}
			{view && request && (
				<Card
					title={`${formatMoney(request.amount, view.currency)} from ${view.orgName}`}
					action={dataSource.kind === "sample" ? <SimulatedTag /> : null}
				>
					<p className={styles.muted}>
						{view.orgName} approved this payment on {formatDateTime(request.createdAt)} and set the
						money aside. It is paid out once both sides confirm: you, the recipient, and the
						organization.
					</p>
					{request.note && <p className={styles.note}>“{request.note}”</p>}
					<dl className={styles.facts}>
						<div>
							<dt>Recipient</dt>
							<dd>
								{shortAddress(request.recipientId)}
								{forMe ? " (you)" : ""}
							</dd>
						</div>
						<div>
							<dt>Recipient confirmed</dt>
							<dd>{confirmed?.recipient ? "Yes" : "Not yet"}</dd>
						</div>
						<div>
							<dt>Organization confirmed</dt>
							<dd>{confirmed?.sender ? "Yes" : "Not yet"}</dd>
						</div>
						<div>
							<dt>Status</dt>
							<dd>
								{request.status === "executed"
									? "Paid out"
									: request.status === "escrowed"
										? "Held"
										: request.status}
							</dd>
						</div>
					</dl>
					{request.status === "escrowed" && forMe && !confirmed?.recipient && (
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={confirm}>
								Confirm: I'm the recipient and the terms are right
							</button>
						</div>
					)}
					{request.status === "escrowed" && !forMe && (
						<p className={styles.muted}>
							Only the recipient's pass ({shortAddress(request.recipientId)}) can confirm here. Open
							this link signed in with that pass.
						</p>
					)}
				</Card>
			)}
		</Page>
	);
}
