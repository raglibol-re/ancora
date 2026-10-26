import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { LIMIT_PERIODS, periodLabel, remainingAllowance } from "../../domain/rules/limits.ts";
import type { Member } from "../../domain/rules/model.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { currencySymbol, formatMoney } from "../../ui/format.ts";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PeopleCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * Members, their roles and their spending limits (crew and agent allowances). Adding, removing,
 * role changes and limits are proposals like any rule change.
 */
export function PeopleCard({ account }: { account: OrgAccount }) {
	const { workspace, personOf, dataSource, me } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { org } = account;
	const onTestnet = dataSource.kind === "testnet";
	const outside = workspace.people.filter((p) => !org.members.some((m) => m.personId === p.id));
	const lowestRole = org.roles.at(-1)?.id ?? "";
	const [inviteId, setInviteId] = useState(onTestnet ? "" : (outside[0]?.id ?? ""));
	const [inviteRole, setInviteRole] = useState(lowestRole);
	const [editingLimit, setEditingLimit] = useState<string | null>(null);
	// Removing the only member, or the only holder of the top role, would lock the organization
	// out of its own rules; the contract refuses it (WouldLockAccount) and so does the button.
	const topRole = org.roles[0]?.id;
	const wouldLock = (personId: string) => {
		const member = org.members.find((m) => m.personId === personId);
		if (!member) return false;
		if (org.members.length === 1) return true;
		return (
			member.roleId === topRole && org.members.filter((m) => m.roleId === topRole).length === 1
		);
	};

	const invite = async (event: FormEvent) => {
		event.preventDefault();
		if (!inviteId.trim()) return;
		const result = await propose({
			type: "addMember",
			personId: inviteId.trim(),
			roleId: inviteRole,
		});
		if (result?.ok && onTestnet) setInviteId("");
	};

	const roleOptions = org.roles.map((role) => (
		<option key={role.id} value={role.id}>
			{role.name}
		</option>
	));

	return (
		<Card title="People" action={onTestnet ? null : <SimulatedTag label="Sample directory" />}>
			<ul className={styles.list}>
				{org.members.map((member) => {
					const person = personOf(member.personId);
					return (
						<li key={member.personId} className={styles.member}>
							<div className={styles.person}>
								<Avatar name={person.name} imageUrl={person.avatarUrl} shape="circle" />
								<span className={styles.name}>
									{person.name}
									{member.personId === me.id && <span className={styles.you}> (you)</span>}
									{onTestnet && <span className={styles.id}>{member.personId}</span>}
								</span>
								<select
									className={controlClass}
									aria-label={`Role of ${person.name}`}
									value={member.roleId}
									disabled={busy}
									onChange={(e) =>
										propose({
											type: "changeRole",
											personId: member.personId,
											roleId: e.target.value,
										})
									}
								>
									{roleOptions}
								</select>
								<button
									type="button"
									className={buttonClass("secondary")}
									disabled={busy || wouldLock(member.personId)}
									title={
										wouldLock(member.personId)
											? "The organization needs at least one member who can approve its rules; the contract refuses this too."
											: undefined
									}
									onClick={() => propose({ type: "removeMember", personId: member.personId })}
								>
									Remove
								</button>
							</div>
							<LimitRow
								account={account}
								member={member}
								editing={editingLimit === member.personId}
								busy={busy}
								onEdit={() => setEditingLimit(member.personId)}
								onDone={() => setEditingLimit(null)}
								propose={propose}
							/>
						</li>
					);
				})}
			</ul>

			{(onTestnet || outside.length > 0) && (
				<form className={styles.invite} onSubmit={invite}>
					{onTestnet ? (
						<Field
							label="Invite by ancora ID"
							htmlFor="invite-person"
							hint="Ask the person for the ID on their pass (starts with C). An agent's key works the same way: add it as a member and give it a spending limit."
						>
							<input
								id="invite-person"
								className={controlClass}
								value={inviteId}
								placeholder="C…"
								spellCheck={false}
								autoComplete="off"
								onChange={(e) => setInviteId(e.target.value)}
							/>
						</Field>
					) : (
						<Field label="Invite" htmlFor="invite-person">
							<select
								id="invite-person"
								className={controlClass}
								value={inviteId}
								onChange={(e) => setInviteId(e.target.value)}
							>
								{outside.map((person) => (
									<option key={person.id} value={person.id}>
										{person.name}
									</option>
								))}
							</select>
						</Field>
					)}
					<Field label="Role" htmlFor="invite-role">
						<select
							id="invite-role"
							className={controlClass}
							value={inviteRole}
							onChange={(e) => setInviteRole(e.target.value)}
						>
							{roleOptions}
						</select>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy || !inviteId.trim()}>
						Add person
					</button>
				</form>
			)}
		</Card>
	);
}

type LimitRowProps = {
	account: OrgAccount;
	member: Member;
	editing: boolean;
	busy: boolean;
	onEdit: () => void;
	onDone: () => void;
	propose: ReturnType<typeof useProposeChange>["propose"];
};

/** A member's allowance: what's left this period, and a small editor for the top role to change it. */
function LimitRow({ account, member, editing, busy, onEdit, onDone, propose }: LimitRowProps) {
	const currency = account.org.baseCurrency;
	const [amount, setAmount] = useState(member.limit ? String(member.limit.amount / 100) : "");
	const [period, setPeriod] = useState(
		member.limit?.periodSeconds ?? LIMIT_PERIODS[2]?.seconds ?? 30 * 86_400,
	);

	const save = async (event: FormEvent) => {
		event.preventDefault();
		const cents = parseAmountInput(amount);
		if (cents === null) return;
		const result = await propose({
			type: "setSpendingLimit",
			personId: member.personId,
			amount: cents,
			periodSeconds: period,
		});
		if (result?.ok) onDone();
	};

	const remove = async () => {
		const result = await propose({
			type: "setSpendingLimit",
			personId: member.personId,
			amount: 0,
			periodSeconds: 0,
		});
		if (result?.ok) onDone();
	};

	if (editing) {
		return (
			<form className={styles.limitForm} onSubmit={save}>
				<label className={styles.limitField}>
					Up to {currencySymbol(currency)}
					<input
						className={`${controlClass} ${styles.small}`}
						inputMode="decimal"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
				</label>
				<label className={styles.limitField}>
					per
					<select
						className={controlClass}
						value={period}
						onChange={(e) => setPeriod(Number(e.target.value))}
					>
						{LIMIT_PERIODS.map((p) => (
							<option key={p.seconds} value={p.seconds}>
								{p.label}
							</option>
						))}
					</select>
				</label>
				<button type="submit" className={buttonClass()} disabled={busy || !amount.trim()}>
					Save limit
				</button>
				{member.limit && (
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={remove}
					>
						Remove limit
					</button>
				)}
				<button type="button" className={styles.linkButton} onClick={onDone}>
					Cancel
				</button>
			</form>
		);
	}
	return (
		<p className={styles.limit}>
			{member.limit ? (
				<>
					Spending limit {formatMoney(member.limit.amount, currency)} per{" "}
					{periodLabel(member.limit.periodSeconds)} ·{" "}
					{formatMoney(remainingAllowance(member.limit, Date.now()), currency)} left; payments
					inside it need no approval.
				</>
			) : (
				"No spending limit: every payment follows the rules."
			)}{" "}
			<button type="button" className={styles.linkButton} disabled={busy} onClick={onEdit}>
				{member.limit ? "Change" : "Set a limit"}
			</button>
		</p>
	);
}
