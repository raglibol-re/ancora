import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { isNewRecipient, type OrgAccount } from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PayPage.module.css";
import { RulePreview } from "./RulePreview.tsx";

const NEW_RECIPIENT = "new";
/** Other organizations on Stellar in this browser, payable without typing their address. */
const ORG_PREFIX = "org:";

export function PayPage() {
	return <OrgRequired>{(account) => <PayForm account={account} />}</OrgRequired>;
}

function PayForm({ account }: { account: OrgAccount }) {
	const { dataSource, me, workspace } = useWorkspace();
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const [payeeId, setPayeeId] = useState(account.payees[0]?.id ?? NEW_RECIPIENT);
	const [newName, setNewName] = useState("");
	const [newAccount, setNewAccount] = useState("");
	const [amountInput, setAmountInput] = useState("");
	const [note, setNote] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	const isNew = payeeId === NEW_RECIPIENT;
	const amount = parseAmountInput(amountInput);
	const otherOrgs = account.onchain
		? workspace.accounts.filter((a) => a.onchain && a.org.id !== account.org.id)
		: [];
	const orgPayee = otherOrgs.find((a) => `${ORG_PREFIX}${a.org.id}` === payeeId);
	const orgAddress = orgPayee?.onchain?.contractId;
	const knownOrgPayee = account.payees.find((p) => p.account === orgAddress);
	const recipientIsNew = isNew
		? true
		: orgPayee
			? !knownOrgPayee || isNewRecipient(account, knownOrgPayee.id)
			: isNewRecipient(account, payeeId);
	const recipientName = isNew
		? newName.trim()
		: (orgPayee?.org.name ?? account.payees.find((p) => p.id === payeeId)?.name);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const found: Record<string, string> = {};
		if (amount === null) found.amount = "Enter an amount like 450 or 1,250.50.";
		if (isNew && !newName.trim()) found.name = "Enter the recipient's name.";
		if (isNew && !newAccount.trim()) {
			found.account = account.onchain
				? "Enter the recipient's Stellar address."
				: "Enter the recipient's IBAN.";
		}
		setErrors(found);
		if (amount === null || Object.keys(found).length > 0) return;

		const result = await run(
			() =>
				dataSource.requestPayment(account.org.id, me.id, {
					payee: isNew
						? { name: newName, account: newAccount }
						: orgPayee && orgAddress
							? { name: orgPayee.org.name, account: orgAddress }
							: { id: payeeId },
					amount,
					note,
				}),
			{
				signature: {
					kind: "passkey",
					title: `Send ${formatMoney(amount, account.currency)} to ${recipientName}`,
				},
			},
		);
		if (result?.ok) navigate(`/app/approvals/${result.value}`);
	};

	return (
		<Page title="Send money" lead={`From the main account of ${account.org.name}.`}>
			<Card>
				<form className={styles.form} onSubmit={submit} noValidate>
					<Field label="Recipient" htmlFor="payee">
						<select
							id="payee"
							className={controlClass}
							value={payeeId}
							onChange={(e) => setPayeeId(e.target.value)}
						>
							{account.payees.map((payee) => (
								<option key={payee.id} value={payee.id}>
									{payee.name}
								</option>
							))}
							{otherOrgs.map((other) => (
								<option key={other.org.id} value={`${ORG_PREFIX}${other.org.id}`}>
									{other.org.name} (organization on ancora)
								</option>
							))}
							<option value={NEW_RECIPIENT}>New recipient…</option>
						</select>
					</Field>
					{isNew && (
						<div className={styles.row}>
							<Field label="Name" htmlFor="payee-name" error={errors.name}>
								<input
									id="payee-name"
									className={controlClass}
									autoComplete="off"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
								/>
							</Field>
							<Field
								label={account.onchain ? "Stellar address" : "IBAN"}
								htmlFor="payee-account"
								error={errors.account}
								hint={account.onchain ? "Starts with G or C. Payments go out as USDC." : undefined}
							>
								<input
									id="payee-account"
									className={controlClass}
									autoComplete="off"
									value={newAccount}
									onChange={(e) => setNewAccount(e.target.value)}
								/>
							</Field>
						</div>
					)}
					<Field label={`Amount (${account.currency})`} htmlFor="amount" error={errors.amount}>
						<input
							id="amount"
							className={`${controlClass} ${styles.amount}`}
							inputMode="decimal"
							autoComplete="off"
							placeholder="0.00"
							value={amountInput}
							onChange={(e) => setAmountInput(e.target.value)}
						/>
					</Field>
					<RulePreview account={account} amount={amount} recipientIsNew={recipientIsNew} />
					<Field label="Reference" htmlFor="note" hint="Shown to approvers and on the statement.">
						<input
							id="note"
							className={controlClass}
							value={note}
							onChange={(e) => setNote(e.target.value)}
						/>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy}>
						Continue
					</button>
				</form>
			</Card>
		</Page>
	);
}
