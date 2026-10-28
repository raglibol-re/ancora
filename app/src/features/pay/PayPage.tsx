import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
	assetOf,
	availableBalance,
	isNewRecipient,
	type OrgAccount,
	primaryToken,
} from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { BatchForm } from "./BatchForm.tsx";
import styles from "./PayPage.module.css";
import { RulePreview } from "./RulePreview.tsx";
import { REPEAT_OPTIONS, type RepeatValue, StandingOrdersCard } from "./StandingOrdersCard.tsx";

const NEW_RECIPIENT = "new";
/** Other organizations on Stellar in this browser, payable without typing their address. */
const ORG_PREFIX = "org:";

export function PayPage() {
	return (
		<OrgRequired>{(account) => <SendMoney key={account.org.id} account={account} />}</OrgRequired>
	);
}

/** One payment, or several as one batch when the organization's contract takes batches. */
function SendMoney({ account }: { account: OrgAccount }) {
	const [mode, setMode] = useState<"one" | "several">("one");
	const batches = !account.onchain || account.onchain.batches;
	return (
		<Page title="Send money" lead={`From the account of ${account.org.name}.`}>
			{batches && (
				<Segmented<"one" | "several">
					label="Recipients"
					value={mode}
					onChange={setMode}
					options={[
						{ value: "one", label: "One recipient" },
						{ value: "several", label: "Several (batch)" },
					]}
				/>
			)}
			{mode === "several" ? <BatchForm account={account} /> : <PayForm account={account} />}
		</Page>
	);
}

function PayForm({ account }: { account: OrgAccount }) {
	const { dataSource, me, workspace } = useWorkspace();
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const requested = params.get("token");
	// Assets with the most available money first; empty ones go last.
	const assetsByAvailable = [...account.org.assets].sort(
		(a, b) => availableBalance(account, b.token) - availableBalance(account, a.token),
	);
	const [token, setToken] = useState(
		requested && assetOf(account.org, requested)
			? requested
			: (assetsByAvailable[0]?.token ?? primaryToken(account)),
	);
	const requestedPayee = params.get("payee");
	const [payeeId, setPayeeId] = useState(
		requestedPayee && account.payees.some((p) => p.id === requestedPayee)
			? requestedPayee
			: (account.payees[0]?.id ?? NEW_RECIPIENT),
	);
	const canSave = !account.onchain || account.onchain.addressBook;
	const [saveNew, setSaveNew] = useState(true);
	const [newName, setNewName] = useState("");
	const [newAccount, setNewAccount] = useState("");
	const [amountInput, setAmountInput] = useState("");
	const [note, setNote] = useState("");
	const [category, setCategory] = useState("");
	const [escrow, setEscrow] = useState(false);
	const [repeat, setRepeat] = useState<"once" | RepeatValue>("once");
	const [errors, setErrors] = useState<Record<string, string>>({});
	/** Per accepted token: null = can receive, a message = why not; absent = not checked yet. */
	const [reachable, setReachable] = useState<Record<string, string | null>>({});

	// A typed address is checked against every accepted asset; "Pay with" moves to one that works.
	useEffect(() => {
		const typed = newAccount.trim();
		if (payeeId !== NEW_RECIPIENT || !account.onchain || typed.length < 56) {
			setReachable({});
			return;
		}
		let cancelled = false;
		const timer = setTimeout(async () => {
			const results = await Promise.all(
				account.org.assets.map(async (a) => {
					const result = await dataSource.canReceive(a.token, typed);
					return [a.token, result.ok ? null : result.error.message] as const;
				}),
			);
			if (cancelled) return;
			const next = Object.fromEntries(results);
			setReachable(next);
			setToken((current) =>
				next[current] === null
					? current
					: (results.find(([, why]) => why === null)?.[0] ?? current),
			);
		}, 600);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [newAccount, payeeId, account.onchain, account.org.assets, dataSource]);

	const asset = assetOf(account.org, token) ?? account.org.assets[0];
	const unreachable = reachable[token];
	const currency = asset?.currency ?? account.org.baseCurrency;
	const isNew = payeeId === NEW_RECIPIENT;
	const amount = parseAmountInput(amountInput);
	// Other organizations that accept the same token can be paid by name.
	const otherOrgs = account.onchain
		? workspace.accounts.filter(
				(a) => a.onchain && a.org.id !== account.org.id && assetOf(a.org, token),
			)
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

		const repeatOption = REPEAT_OPTIONS.find((option) => option.value === repeat);
		if (repeatOption) {
			const to = isNew
				? newAccount.trim()
				: orgPayee && orgAddress
					? orgAddress
					: (account.payees.find((p) => p.id === payeeId)?.account ?? "");
			const set = await run(
				() =>
					dataSource.setStandingOrder(account.org.id, me.id, {
						to,
						token,
						amount,
						note,
						category: category || null,
						intervalSeconds: repeatOption.seconds,
						firstAt: Date.now(),
					}),
				{
					signature: {
						kind: "passkey",
						title: `Pay ${formatMoney(amount, currency)} to ${recipientName} ${repeatOption.label}`,
					},
					success: "Standing order set. The first payment runs now, under the rules.",
				},
			);
			if (set?.ok) {
				setRepeat("once");
				setAmountInput("");
				setNote("");
			}
			return;
		}

		const result = await run(
			() =>
				dataSource.requestPayment(account.org.id, me.id, {
					payee: isNew
						? { name: newName, account: newAccount }
						: orgPayee && orgAddress
							? { name: orgPayee.org.name, account: orgAddress }
							: { id: payeeId },
					token,
					amount,
					note,
					category: category || null,
					escrow,
				}),
			{
				signature: {
					kind: "passkey",
					title: `Send ${formatMoney(amount, currency)} to ${recipientName}`,
				},
			},
		);
		if (result?.ok && isNew && canSave && saveNew) {
			// A second, small transaction: the name stays with the address for every member.
			await run(
				() =>
					dataSource.savePayee(account.org.id, me.id, {
						account: newAccount,
						name: newName,
						note: "",
					}),
				{
					signature: { kind: "passkey", title: `Save ${newName.trim()} in the address book` },
					success: `${newName.trim()} is in the address book.`,
				},
			);
		}
		if (result?.ok) navigate(`/app/approvals/${result.value}`);
	};

	return (
		<>
			<Card>
				<form className={styles.form} onSubmit={submit} noValidate>
					{account.org.assets.length > 1 && (
						<Field
							label="Pay with"
							htmlFor="asset"
							hint={`The rules are written in ${account.org.baseCurrency}; a payment in another currency takes the strictest tier.`}
						>
							<select
								id="asset"
								className={controlClass}
								value={token}
								onChange={(e) => setToken(e.target.value)}
							>
								{assetsByAvailable.map((a) => {
									const free = availableBalance(account, a.token);
									return (
										<option key={a.token} value={a.token}>
											{a.symbol} ({a.currency}) ·{" "}
											{free > 0 ? `${formatMoney(free, a.currency)} available` : "no balance"}
											{reachable[a.token] === null
												? " · recipient can receive it"
												: reachable[a.token]
													? " · recipient can't receive it"
													: ""}
										</option>
									);
								})}
							</select>
						</Field>
					)}
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
								hint={
									account.onchain
										? `Starts with G or C. The payment goes out as ${asset?.symbol ?? "the chosen asset"}; a G address must already hold a trustline for exactly that asset (testnet has several assets called USDC).`
										: undefined
								}
							>
								<input
									id="payee-account"
									className={controlClass}
									autoComplete="off"
									value={newAccount}
									onChange={(e) => setNewAccount(e.target.value)}
								/>
							</Field>
							{canSave && (
								<label className={styles.toggle}>
									<input
										type="checkbox"
										checked={saveNew}
										onChange={(e) => setSaveNew(e.target.checked)}
									/>
									<span>
										<strong>Save to the address book.</strong> Everyone in {account.org.name} then
										sees this name for the address.
									</span>
								</label>
							)}
						</div>
					)}
					<Field label={`Amount (${currency})`} htmlFor="amount" error={errors.amount}>
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
					{unreachable && (
						<p className={styles.recipientWarning} role="status">
							{unreachable}
						</p>
					)}
					{unreachable === null && isNew && (
						<p className={styles.recipientOk} role="status">
							This address can receive {asset?.symbol ?? "the chosen asset"}.
						</p>
					)}
					<RulePreview
						account={account}
						token={token}
						amount={amount}
						recipientIsNew={recipientIsNew}
						category={category || null}
					/>
					{account.org.policy.budgets.length > 0 && (
						<Field
							label="Budget category"
							htmlFor="category"
							hint="Optional. The payment counts against this budget; beyond it the rules escalate or refuse."
						>
							<select
								id="category"
								className={controlClass}
								value={category}
								onChange={(e) => setCategory(e.target.value)}
							>
								<option value="">None</option>
								{account.org.policy.budgets.map((budget) => (
									<option key={budget.category} value={budget.category}>
										#{budget.category}
									</option>
								))}
							</select>
						</Field>
					)}
					{account.standingOrders !== null && (
						<Field
							label="Repeat"
							htmlFor="repeat"
							hint="A standing order pays again on schedule; every run follows the rules like a one-off payment."
						>
							<select
								id="repeat"
								className={controlClass}
								value={repeat}
								onChange={(e) => setRepeat(e.target.value as "once" | RepeatValue)}
							>
								<option value="once">Once</option>
								{REPEAT_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.title}
									</option>
								))}
							</select>
						</Field>
					)}
					{repeat === "once" && (
						<label className={styles.toggle}>
							<input
								type="checkbox"
								checked={escrow}
								onChange={(e) => setEscrow(e.target.checked)}
							/>
							<span>
								<strong>Secure handover.</strong> After approval the money is set aside and only
								paid out once the recipient and {account.org.name} both confirm. You get a link to
								send the recipient.
							</span>
						</label>
					)}
					<Field label="Reference" htmlFor="note" hint="Shown to approvers and on the statement.">
						<input
							id="note"
							className={controlClass}
							value={note}
							onChange={(e) => setNote(e.target.value)}
						/>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy}>
						{repeat === "once" ? "Continue" : "Set standing order"}
					</button>
				</form>
			</Card>
			<StandingOrdersCard account={account} />
		</>
	);
}
