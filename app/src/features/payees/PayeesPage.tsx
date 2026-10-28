import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { type OrgAccount, type Payee, shortAddress } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PayeesPage.module.css";

export function PayeesPage() {
	return (
		<Page title="Address book" lead="The people and companies your organization pays.">
			<OrgRequired>
				{(account) => <AddressBook key={account.org.id} account={account} />}
			</OrgRequired>
		</Page>
	);
}

/** When the organization last paid this recipient, from its activity. */
function lastPaid(account: OrgAccount, payee: Payee): number | null {
	const entry = account.activity.find(
		(e) => e.kind === "payment-out" && (e.payeeId === payee.id || e.payeeId === payee.account),
	);
	return entry?.at ?? null;
}

function AddressBook({ account }: { account: OrgAccount }) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const supported = !account.onchain || account.onchain.addressBook;
	const [editing, setEditing] = useState<Payee | null>(null);
	const [name, setName] = useState("");
	const [address, setAddress] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const saved = account.payees.filter((p) => p.saved);
	const others = account.payees.filter((p) => !p.saved);

	const startEdit = (payee: Payee) => {
		setEditing(payee);
		setName(payee.saved ? payee.name : "");
		setAddress(payee.account);
		setNote(payee.note ?? "");
		setError(null);
		document.getElementById("payee-form")?.scrollIntoView({ behavior: "smooth" });
	};

	const reset = () => {
		setEditing(null);
		setName("");
		setAddress("");
		setNote("");
	};

	const save = async (event: FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			setError("Give the recipient a name.");
			return;
		}
		if (!address.trim()) {
			setError(account.onchain ? "Enter a Stellar address." : "Enter an IBAN.");
			return;
		}
		setError(null);
		const result = await run(
			() => dataSource.savePayee(account.org.id, me.id, { account: address, name, note }),
			{
				signature: { kind: "passkey", title: `Save ${name.trim()} in the address book` },
				success: `${name.trim()} is in the address book.`,
			},
		);
		if (result?.ok) reset();
	};

	const remove = (payee: Payee) =>
		run(() => dataSource.removePayee(account.org.id, me.id, payee.account), {
			signature: { kind: "passkey", title: `Remove ${payee.name} from the address book` },
			success: `${payee.name} was removed from the address book.`,
		});

	const row = (payee: Payee) => {
		const paid = lastPaid(account, payee);
		return (
			<li key={payee.id} className={styles.row}>
				<span className={styles.text}>
					<span className={styles.name}>{payee.name}</span>
					<span className={styles.meta}>
						<code>{payee.account.length > 24 ? shortAddress(payee.account) : payee.account}</code>
						{paid !== null ? ` · last paid ${formatDateTime(paid)}` : " · not paid yet"}
						{payee.saved && payee.savedBy && ` · saved by ${personName(payee.savedBy)}`}
					</span>
					{payee.note && <span className={styles.note}>{payee.note}</span>}
				</span>
				<span className={styles.actions}>
					<Link
						to={`/app/pay?payee=${encodeURIComponent(payee.id)}`}
						className={buttonClass("secondary")}
					>
						Pay
					</Link>
					{supported && (
						<button
							type="button"
							className={buttonClass("secondary")}
							disabled={busy}
							onClick={() => startEdit(payee)}
						>
							{payee.saved ? "Edit" : "Save"}
						</button>
					)}
					{supported && payee.saved && (
						<button
							type="button"
							className={buttonClass("secondary")}
							disabled={busy}
							onClick={() => void remove(payee)}
						>
							Remove
						</button>
					)}
				</span>
			</li>
		);
	};

	return (
		<>
			<Card title="Saved recipients">
				{saved.length === 0 ? (
					<p className={styles.muted}>
						Nobody saved yet. Save a recipient below, or tick "Save to the address book" when you
						pay someone new; every member then sees the same name for that address.
					</p>
				) : (
					<ul className={styles.list}>{saved.map(row)}</ul>
				)}
			</Card>
			{others.length > 0 && (
				<Card title="Paid before, not saved">
					<ul className={styles.list}>{others.map(row)}</ul>
				</Card>
			)}
			{supported ? (
				<Card title={editing?.saved ? `Edit ${editing.name}` : "Save a recipient"}>
					<form id="payee-form" className={styles.form} onSubmit={save}>
						<Field label="Name" htmlFor="book-name">
							<input
								id="book-name"
								className={controlClass}
								value={name}
								autoComplete="off"
								maxLength={64}
								onChange={(e) => setName(e.target.value)}
							/>
						</Field>
						<Field
							label={account.onchain ? "Stellar address" : "IBAN"}
							htmlFor="book-address"
							hint={account.onchain ? "Starts with G or C." : undefined}
						>
							<input
								id="book-address"
								className={controlClass}
								value={address}
								autoComplete="off"
								readOnly={editing !== null}
								onChange={(e) => setAddress(e.target.value)}
							/>
						</Field>
						<Field label="Note" htmlFor="book-note" hint="Optional, shown to every member.">
							<input
								id="book-note"
								className={controlClass}
								value={note}
								autoComplete="off"
								maxLength={140}
								onChange={(e) => setNote(e.target.value)}
							/>
						</Field>
						{error && (
							<p className={styles.error} role="alert">
								{error}
							</p>
						)}
						<div className={styles.buttons}>
							<button type="submit" className={buttonClass()} disabled={busy}>
								{editing?.saved ? "Save changes" : "Save recipient"}
							</button>
							{editing && (
								<button type="button" className={buttonClass("secondary")} onClick={reset}>
									Cancel
								</button>
							)}
						</div>
					</form>
				</Card>
			) : (
				<Card title="Save recipients">
					<p className={styles.muted}>
						This organization was created before the address book existed; organizations created
						from 28 Oct 2026 keep saved recipients on their contract for every member.
					</p>
				</Card>
			)}
		</>
	);
}
