import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { type OrgAccount, type Payee, shortAddress } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PayeesPage.module.css";

export function PayeesPage() {
	const t = useT();
	return (
		<Page title={t("Address book")} lead={t("The people and companies your organization pays.")}>
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
	const t = useT();
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
			setError(t("Give the recipient a name."));
			return;
		}
		if (!address.trim()) {
			setError(account.onchain ? t("Enter a Stellar address.") : t("Enter an IBAN."));
			return;
		}
		setError(null);
		const result = await run(
			() => dataSource.savePayee(account.org.id, me.id, { account: address, name, note }),
			{
				signature: {
					kind: "passkey",
					title: t("Save {name} in the address book", { name: name.trim() }),
				},
				success: t("{name} is in the address book.", { name: name.trim() }),
			},
		);
		if (result?.ok) reset();
	};

	const remove = (payee: Payee) =>
		run(() => dataSource.removePayee(account.org.id, me.id, payee.account), {
			signature: {
				kind: "passkey",
				title: t("Remove {name} from the address book", { name: payee.name }),
			},
			success: t("{name} was removed from the address book.", { name: payee.name }),
		});

	const row = (payee: Payee) => {
		const paid = lastPaid(account, payee);
		return (
			<li key={payee.id} className={styles.row}>
				<span className={styles.text}>
					<span className={styles.name}>{payee.name}</span>
					<span className={styles.meta}>
						<code>{payee.account.length > 24 ? shortAddress(payee.account) : payee.account}</code>
						{paid !== null ? ` · last paid ${formatDateTime(paid)}` : t(" · not paid yet")}
						{payee.saved && payee.savedBy && ` · saved by ${personName(payee.savedBy)}`}
					</span>
					{payee.note && <span className={styles.note}>{payee.note}</span>}
				</span>
				<span className={styles.actions}>
					<Link
						to={`/app/pay?payee=${encodeURIComponent(payee.id)}`}
						className={buttonClass("secondary")}
					>
						{t("Pay")}
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
							{t("Remove")}
						</button>
					)}
				</span>
			</li>
		);
	};

	return (
		<>
			<Card title={t("Saved recipients")}>
				{saved.length === 0 ? (
					<p className={styles.muted}>
						{t(
							'Nobody saved yet. Save a recipient below, or tick "Save to the address book" when you pay someone new; every member then sees the same name for that address.',
						)}
					</p>
				) : (
					<ul className={styles.list}>{saved.map(row)}</ul>
				)}
			</Card>
			{others.length > 0 && (
				<Card title={t("Paid before, not saved")}>
					<ul className={styles.list}>{others.map(row)}</ul>
				</Card>
			)}
			{supported ? (
				<Card title={editing?.saved ? `Edit ${editing.name}` : t("Save a recipient")}>
					<form id="payee-form" className={styles.form} onSubmit={save}>
						<Field label={t("Name")} htmlFor="book-name">
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
							label={account.onchain ? t("Stellar address") : "IBAN"}
							htmlFor="book-address"
							hint={account.onchain ? t("Starts with G or C.") : undefined}
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
						<Field
							label={t("Note")}
							htmlFor="book-note"
							hint={t("Optional, shown to every member.")}
						>
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
								{t(error)}
							</p>
						)}
						<div className={styles.buttons}>
							<button type="submit" className={buttonClass()} disabled={busy}>
								{editing?.saved ? t("Save changes") : t("Save recipient")}
							</button>
							{editing && (
								<button type="button" className={buttonClass("secondary")} onClick={reset}>
									{t("Cancel")}
								</button>
							)}
						</div>
					</form>
				</Card>
			) : (
				<Card title={t("Save recipients")}>
					<p className={styles.muted}>
						{t(
							"This organization was created before the address book existed; organizations created from 28 Oct 2026 keep saved recipients on their contract for every member.",
						)}
					</p>
				</Card>
			)}
		</>
	);
}
