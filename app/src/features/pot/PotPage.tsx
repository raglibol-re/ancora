import { availableBalance, type OrgAccount, shortAddress } from "../../domain/account.ts";
import type { PotOutcome, PotStatus, PotSupport } from "../../domain/dataSource.ts";
import type { Cents } from "../../domain/money.ts";
import type { Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime, formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Pot.module.css";
import { PotAmountForm } from "./PotAmountForm.tsx";
import { usePot } from "./usePot.ts";

/** What to say once a pot step went through: done, or waiting for the rules. */
const said = (done: string) => (outcome: PotOutcome) =>
	outcome === "applied" ? done : "Requested. It goes once your rules are met (see Approvals).";

const ENTRY_LABELS = {
	deposit: "Moved in",
	withdraw: "Taken out",
	sent: "Paid",
	received: "Received",
} as const;

export function PotPage() {
	return (
		<Page
			title="Confidential pot"
			lead="Money in the pot is held by a Stellar contract that hides its balance and the amounts paid between pots. Your members read them on their devices; who pays whom, and what moves in or out, stays public."
		>
			<OrgRequired>{(account) => <Pot key={account.org.id} account={account} />}</OrgRequired>
		</Page>
	);
}

function Pot({ account }: { account: OrgAccount }) {
	const { support, status, error, loading, load } = usePot(account.org.id);
	if (!support) {
		return (
			<Card title="Confidential pot">
				<p className={styles.muted}>
					The pot runs on the Stellar testnet. Switch to the testnet on your pass to use it.
				</p>
			</Card>
		);
	}
	return (
		<Card
			title="Confidential pot"
			action={<SimulatedTag label="Preview" title="A testnet preview, not audited" />}
		>
			<p className={styles.muted}>
				A preview on the testnet: the proofs follow OpenZeppelin's confidential token, whose recipe
				is still provisional, and nothing here has been audited. Each step that moves money is a
				request under your organization's rules; a payment's amount can't be seen by the contract,
				so it always takes your strictest approvals.
			</p>
			{error && (
				<p className={styles.muted} role="alert">
					{error}
				</p>
			)}
			{status ? (
				<PotBody
					account={account}
					support={support}
					status={status}
					reading={loading}
					onChanged={load}
				/>
			) : (
				<p className={styles.muted}>Reading the pot…</p>
			)}
			<p className={styles.meta}>
				Pot contract <code className={styles.code}>{shortAddress(support.contract())}</code>
			</p>
		</Card>
	);
}

type BodyProps = {
	account: OrgAccount;
	support: PotSupport;
	status: PotStatus;
	/** The pot is being read again; amounts aren't checked until it's done. */
	reading: boolean;
	onChanged: () => void;
};

function PotBody({ account, support, status, reading, onChanged }: BodyProps) {
	const { me, personName } = useWorkspace();
	const { run, busy: running } = useCommand();
	const busy = running || reading;
	const orgId = account.org.id;
	const asset = account.org.assets.find((a) => a.token === support.asset());

	const step = async <T,>(
		title: string,
		action: () => Promise<Result<T, RuleError>>,
		success: (value: T) => string,
	) => {
		const result = await run(action, { signature: { kind: "passkey", title }, success });
		onChanged();
		return Boolean(result?.ok);
	};

	if (status.state === "unavailable") return <p className={styles.muted}>{status.reason}</p>;
	if (!asset) {
		return (
			<p className={styles.muted}>
				The pot holds the test USDC. Accept it under Rules → Accounts to use the pot.
			</p>
		);
	}
	const money = (cents: Cents) => formatMoney(cents, asset.currency);

	if (status.state === "closed" || status.state === "opening") {
		return (
			<div className={styles.form}>
				<p className={styles.muted}>
					{status.state === "closed"
						? "Opening the pot creates its key (kept with your private details, so every member's device reads it), proves it on this device, and asks your organization to open its pot account. Your passkey is asked a few times."
						: "The pot key exists; opening the account waits for your rules (see Approvals). If that request was declined, ask again."}
				</p>
				<div className={styles.actions}>
					<button
						type="button"
						className={buttonClass()}
						disabled={busy}
						onClick={() =>
							step(
								"Open the confidential pot",
								() => support.open(orgId, me.id),
								said("The pot is open."),
							)
						}
					>
						{status.state === "closed" ? "Open the pot" : "Ask again"}
					</button>
				</div>
			</div>
		);
	}
	if (status.state === "unreadable") {
		return (
			<p className={styles.muted}>
				The pot is open, but the history the network keeps (about a week) doesn't reach back far
				enough to read its balance on this device. Its money is safe; the next payment out or
				in-and-merge will make it readable again.
			</p>
		);
	}

	return (
		<div className={styles.form}>
			<div>
				<p className={styles.balance}>{money(status.spendable)}</p>
				<p className={styles.meta}>
					Spendable in the pot
					{status.incoming > 0 ? ` · ${money(status.incoming)} arrived, not yet spendable` : ""}
				</p>
			</div>
			{status.incoming > 0 && (
				<div className={styles.actions}>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() =>
							step(
								"Make the pot's incoming money spendable",
								() => support.merge(orgId, me.id),
								() => "The incoming money is spendable now.",
							)
						}
					>
						Make it spendable
					</button>
				</div>
			)}
			<div className={styles.grid}>
				<PotAmountForm
					title="Move money in"
					hint="From the account into the pot. The amount is public; what happens to it in the pot isn't."
					action="Move in"
					currency={asset.currency}
					max={availableBalance(account, asset.token)}
					busy={busy}
					onSubmit={(amount) =>
						step(
							"Move money into the pot",
							() => support.deposit(orgId, me.id, amount),
							said(`${money(amount)} moved into the pot.`),
						)
					}
				/>
				<PotAmountForm
					title="Pay another organization"
					hint="To their pot. Only your two organizations read the amount. The proof is made on this device and takes a few seconds."
					action="Pay privately"
					currency={asset.currency}
					max={status.spendable + status.incoming}
					withRecipient
					busy={busy}
					onSubmit={(amount, to) =>
						step(
							"Pay from the confidential pot",
							() => support.pay(orgId, me.id, to, amount),
							said("Paid. Only your two organizations can read the amount."),
						)
					}
				/>
				<PotAmountForm
					title="Take money out"
					hint="Back to the account; the amount becomes public."
					action="Take out"
					currency={asset.currency}
					max={status.spendable + status.incoming}
					busy={busy}
					onSubmit={(amount) =>
						step(
							"Take money out of the pot",
							() => support.withdraw(orgId, me.id, amount),
							said(`${money(amount)} taken out of the pot.`),
						)
					}
				/>
			</div>
			<h3>History</h3>
			{status.entries.length === 0 ? (
				<p className={styles.muted}>Nothing yet in the last week.</p>
			) : (
				<ul className={styles.list}>
					{status.entries.map((entry) => (
						<li key={entry.id} className={styles.row}>
							<span>
								{ENTRY_LABELS[entry.kind]}
								<span className={styles.meta}>
									{" "}
									· {formatDateTime(entry.at)} ·{" "}
									{entry.counterparty === orgId
										? "this organization"
										: personName(entry.counterparty)}
								</span>
							</span>
							<span>{money(entry.amount)}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
