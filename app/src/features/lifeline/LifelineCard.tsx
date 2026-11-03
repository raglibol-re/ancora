import { type FormEvent, useState } from "react";
import { shortAddress } from "../../domain/account.ts";
import {
	claimProgress,
	describePlanProblem,
	type LifelineOverview,
	MAX_GUARDIANS,
	type RecoveryPlan,
	validatePlan,
	WAIT_OPTIONS,
} from "../../domain/lifeline.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Lifeline.module.css";
import { describeTimeLeft, describeWait } from "./lifelineTime.ts";

type LifelineCardProps = {
	overview: LifelineOverview | null;
	error: string | null;
	onChanged: () => void;
};

/**
 * My recovery plan: who can vouch for a new pass of mine, how many of them, and how long a
 * claim waits. Shows an open claim against my pass with a way to cancel it.
 */
export function LifelineCard({ overview, error, onChanged }: LifelineCardProps) {
	const t = useT();
	const { dataSource, me, workspace, personOf, myAccounts } = useWorkspace();
	const { run, busy } = useCommand();
	const [editing, setEditing] = useState(false);
	const plan = overview?.plan ?? null;
	const claim = overview?.claim ?? null;
	const sample = dataSource.kind === "sample";
	const legacy = myAccounts.filter((a) => a.onchain && !a.onchain.supportsRecovery);

	const cancel = async () => {
		const result = await run(() => dataSource.lifeline.cancelClaim(me.id), {
			success: t("The claim is cancelled. Your pass stays as it is."),
		});
		if (result?.ok) onChanged();
	};

	const remove = async () => {
		const result = await run(() => dataSource.lifeline.clearPlan(me.id), {
			success: t("Your recovery plan is removed."),
		});
		if (result?.ok) {
			setEditing(false);
			onChanged();
		}
	};

	return (
		<div id="lifeline">
			<Card title={t("Lifeline")} action={sample ? <SimulatedTag /> : null}>
				<p className={styles.muted}>
					{t(
						"If you lose this pass, the guardians you name here can confirm a new one. After the waiting period your positions in every organization move to it. Recovery never moves money, and while a claim waits you can cancel it from this pass.",
					)}
				</p>
				{error && <p className={styles.error}>{t(error)}</p>}
				{overview && !claim && (
					<p className={styles.status}>
						{plan ? (
							<>
								<span className={styles.protected}>{t("Protected")}</span>
								<span className={styles.muted}>
									{plan.guardians.length === 1
										? t("{needed} of 1 guardian confirm · {wait} waiting period", {
												needed: plan.threshold,
												wait: describeWait(plan.waitSeconds),
											})
										: t("{needed} of {total} guardians confirm · {wait} waiting period", {
												needed: plan.threshold,
												total: plan.guardians.length,
												wait: describeWait(plan.waitSeconds),
											})}
								</span>
							</>
						) : (
							<>
								<span className={styles.warn}>{t("Not protected yet")}</span>
								<span className={styles.muted}>
									{t("This pass is the only key to your positions. Name guardians.")}
								</span>
							</>
						)}
					</p>
				)}
				{plan && claim && (
					<div className={styles.alert} role="alert">
						<strong>{t("Someone is recovering your pass.")}</strong>
						<span>
							{t(
								"New pass {pass}, confirmed by {confirmed} of {needed} guardians; can finish {when}. If this is not you, cancel it now: your current pass keeps everything.",
								{
									pass: shortAddress(claim.successor),
									confirmed: claimProgress(plan, claim, Date.now()).confirmed,
									needed: plan.threshold,
									when: describeTimeLeft(claim.readyAt - Date.now()),
								},
							)}
						</span>
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={cancel}>
								{t("Cancel this claim")}
							</button>
						</div>
					</div>
				)}
				{plan && !editing && (
					<ul className={styles.guardians}>
						{plan.guardians.map((id) => {
							const person = personOf(id);
							return (
								<li key={id} className={styles.guardian}>
									<Avatar name={person.name} imageUrl={person.avatarUrl} shape="circle" size="sm" />
									<span className={styles.guardianName}>
										{person.name}
										{!sample && <span className={styles.id}> · {shortAddress(id)}</span>}
									</span>
								</li>
							);
						})}
					</ul>
				)}
				{legacy.length > 0 && (
					<p className={styles.muted}>
						{t(
							"Positions in {organizations} were created before Lifeline and can't be handed over; new organizations can.",
							{ organizations: legacy.map((a) => a.org.name).join(", ") },
						)}
					</p>
				)}
				{overview && !editing && (
					<div className={styles.actions}>
						<button
							type="button"
							className={buttonClass(plan ? "secondary" : "primary")}
							disabled={busy}
							onClick={() => setEditing(true)}
						>
							{plan ? t("Change plan") : t("Set up Lifeline")}
						</button>
						{plan && (
							<button type="button" className={styles.linkButton} disabled={busy} onClick={remove}>
								{t("Remove plan")}
							</button>
						)}
					</div>
				)}
				{editing && (
					<PlanForm
						initial={plan}
						people={workspace.people.filter((p) => p.id !== me.id)}
						allowTyping={!sample}
						busy={busy}
						onCancel={() => setEditing(false)}
						onSave={async (next) => {
							const result = await run(() => dataSource.lifeline.setPlan(me.id, next), {
								success: t("Your recovery plan is saved."),
							});
							if (result?.ok) {
								setEditing(false);
								onChanged();
							}
						}}
					/>
				)}
			</Card>
		</div>
	);
}

type PlanFormProps = {
	initial: RecoveryPlan | null;
	people: readonly { id: string; name: string }[];
	allowTyping: boolean;
	busy: boolean;
	onCancel: () => void;
	onSave: (plan: RecoveryPlan) => void;
};

function PlanForm({ initial, people, allowTyping, busy, onCancel, onSave }: PlanFormProps) {
	const t = useT();
	const { me } = useWorkspace();
	const [guardians, setGuardians] = useState<string[]>([...(initial?.guardians ?? [])]);
	const [typed, setTyped] = useState("");
	const [threshold, setThreshold] = useState(initial?.threshold ?? 1);
	const [wait, setWait] = useState(initial?.waitSeconds ?? WAIT_OPTIONS[0]?.seconds ?? 120);
	const [problem, setProblem] = useState<string | null>(null);
	const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? shortAddress(id);

	const toggle = (id: string) =>
		setGuardians((current) =>
			current.includes(id) ? current.filter((g) => g !== id) : [...current, id],
		);

	const addTyped = () => {
		const id = typed.trim();
		if (!id) return;
		if (!guardians.includes(id)) setGuardians([...guardians, id]);
		setTyped("");
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const plan = { guardians, threshold, waitSeconds: wait };
		const invalid = validatePlan(me.id, plan);
		if (invalid) {
			setProblem(describePlanProblem(invalid));
			return;
		}
		setProblem(null);
		onSave(plan);
	};

	return (
		<form className={styles.form} onSubmit={submit}>
			<fieldset className={styles.form}>
				<legend>{t("Guardians (up to {count})", { count: MAX_GUARDIANS })}</legend>
				{people.length > 0 && (
					<ul className={styles.guardians}>
						{people.map((person) => (
							<li key={person.id} className={styles.guardian}>
								<label className={styles.guardian}>
									<input
										type="checkbox"
										checked={guardians.includes(person.id)}
										onChange={() => toggle(person.id)}
									/>
									<span className={styles.guardianName}>{person.name}</span>
								</label>
							</li>
						))}
					</ul>
				)}
				{guardians
					.filter((id) => !people.some((p) => p.id === id))
					.map((id) => (
						<p key={id} className={styles.guardian}>
							<span className={styles.guardianName}>{nameOf(id)}</span>
							<button type="button" className={styles.linkButton} onClick={() => toggle(id)}>
								{t("Remove")}
							</button>
						</p>
					))}
				{allowTyping && (
					<div className={styles.row}>
						<Field
							label={t("Add a guardian by ancora ID")}
							htmlFor="guardian-id"
							hint={t("Anyone with an ancora pass, also outside your organizations.")}
						>
							<input
								id="guardian-id"
								className={controlClass}
								value={typed}
								placeholder="C…"
								spellCheck={false}
								autoComplete="off"
								onChange={(e) => setTyped(e.target.value)}
							/>
						</Field>
						<div>
							<button
								type="button"
								className={buttonClass("secondary")}
								disabled={!typed.trim()}
								onClick={addTyped}
							>
								{t("Add")}
							</button>
						</div>
					</div>
				)}
			</fieldset>
			<div className={styles.row}>
				<Field label={t("Confirmations needed")} htmlFor="threshold">
					<select
						id="threshold"
						className={controlClass}
						value={threshold}
						onChange={(e) => setThreshold(Number(e.target.value))}
					>
						{Array.from({ length: Math.max(1, guardians.length) }, (_, i) => i + 1).map((n) => (
							<option key={n} value={n}>
								{t("{needed} of {total}", { needed: n, total: Math.max(1, guardians.length) })}
							</option>
						))}
					</select>
				</Field>
				<Field
					label={t("Waiting period")}
					htmlFor="wait"
					hint={t("Time you have to cancel a claim that isn't yours.")}
				>
					<select
						id="wait"
						className={controlClass}
						value={wait}
						onChange={(e) => setWait(Number(e.target.value))}
					>
						{WAIT_OPTIONS.map((option) => (
							<option key={option.seconds} value={option.seconds}>
								{t(option.label)}
							</option>
						))}
					</select>
				</Field>
			</div>
			{problem && (
				<p className={styles.error} role="alert">
					{t(problem)}
				</p>
			)}
			<div className={styles.actions}>
				<button type="submit" className={buttonClass()} disabled={busy}>
					{busy ? "Saving…" : t("Save plan")}
				</button>
				<button type="button" className={styles.linkButton} onClick={onCancel}>
					{t("Cancel")}
				</button>
			</div>
		</form>
	);
}
