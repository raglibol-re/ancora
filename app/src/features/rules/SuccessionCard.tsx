import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { Succession } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Controls.module.css";
import { useProposeChange } from "./useProposeChange.ts";

const DAY = 86_400;

/**
 * Lifeline inside the organization: who takes over a position when its holder goes quiet, so a
 * rule like "two of two" never deadlocks. Plans are rule changes; claims follow the plan.
 */
export function SuccessionCard({ account }: { account: OrgAccount }) {
	const { dataSource, me, personName } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { run } = useCommand();
	const { org } = account;
	const support = dataSource.continuity;
	const [personId, setPersonId] = useState(org.members[0]?.personId ?? "");
	const [successorId, setSuccessorId] = useState(org.members[1]?.personId ?? "");
	const [quietDays, setQuietDays] = useState("180");
	const [waitDays, setWaitDays] = useState("7");
	const [error, setError] = useState<string | null>(null);
	const now = Date.now();
	const plans = org.successions ?? [];

	const save = async (event: FormEvent) => {
		event.preventDefault();
		const inactiveSeconds = Math.round(Number(quietDays) * DAY);
		const waitSeconds = Math.round(Number(waitDays) * DAY);
		if (personId === successorId) {
			setError("Pick someone else as the successor.");
			return;
		}
		if (!(inactiveSeconds >= 60 && waitSeconds >= 60)) {
			setError("Enter the quiet period and the wait in days (at least a minute each).");
			return;
		}
		setError(null);
		await propose({ type: "setSuccessor", personId, successorId, inactiveSeconds, waitSeconds });
	};

	const status = (plan: Succession) => {
		const quietUntil = plan.lastSeen + plan.inactiveSeconds * 1000;
		if (plan.claimReadyAt !== null) {
			return plan.claimReadyAt <= now
				? "Claimed; the handover can be finished now."
				: `Claimed; handover on ${formatDateTime(plan.claimReadyAt)} unless ${personName(plan.personId)} acts first.`;
		}
		return quietUntil <= now
			? `Quiet since ${formatDateTime(plan.lastSeen)}: ${personName(plan.successorId)} may claim the position.`
			: `Last seen ${formatDateTime(plan.lastSeen)}.`;
	};

	const act = (label: string, action: () => ReturnType<NonNullable<typeof support>["stillHere"]>) =>
		run(action, { signature: { kind: "passkey", title: label }, success: "Done." });

	return (
		<Card title="Succession">
			<p className={styles.muted}>
				If someone goes quiet for longer than their quiet period, the successor they were given can
				claim their position. Any action of theirs during the wait cancels the claim; after it, the
				successor takes over and they leave. Money never moves.
			</p>
			{plans.length > 0 && (
				<ul className={styles.list}>
					{plans.map((plan) => {
						const quiet = plan.lastSeen + plan.inactiveSeconds * 1000 <= now;
						return (
							<li key={plan.personId} className={styles.item}>
								<span>
									{personName(plan.successorId)} takes over from {personName(plan.personId)} after{" "}
									{Math.round(plan.inactiveSeconds / DAY)} quiet days. {status(plan)}
								</span>
								{support && (
									<span className={styles.row}>
										{plan.personId === me.id && plan.claimReadyAt !== null && (
											<button
												type="button"
												className={buttonClass()}
												onClick={() =>
													act("I'm still here", () => support.stillHere(org.id, me.id))
												}
											>
												I'm still here
											</button>
										)}
										{plan.successorId === me.id && quiet && plan.claimReadyAt === null && (
											<button
												type="button"
												className={buttonClass("secondary")}
												onClick={() =>
													act(`Claim the position of ${personName(plan.personId)}`, () =>
														support.claim(org.id, me.id, plan.personId),
													)
												}
											>
												Claim the position
											</button>
										)}
										{plan.claimReadyAt !== null && plan.claimReadyAt <= now && (
											<button
												type="button"
												className={buttonClass("secondary")}
												onClick={() =>
													act("Finish the handover", () => support.finish(org.id, plan.personId))
												}
											>
												Finish the handover
											</button>
										)}
									</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
			<form className={styles.form} onSubmit={save} noValidate>
				<div className={styles.row}>
					<Field label="Position of" htmlFor="succession-person">
						<select
							id="succession-person"
							className={controlClass}
							value={personId}
							onChange={(e) => setPersonId(e.target.value)}
						>
							{org.members.map((m) => (
								<option key={m.personId} value={m.personId}>
									{personName(m.personId)}
								</option>
							))}
						</select>
					</Field>
					<Field label="Taken over by" htmlFor="succession-successor">
						<select
							id="succession-successor"
							className={controlClass}
							value={successorId}
							onChange={(e) => setSuccessorId(e.target.value)}
						>
							{org.members.map((m) => (
								<option key={m.personId} value={m.personId}>
									{personName(m.personId)}
								</option>
							))}
						</select>
					</Field>
				</div>
				<div className={styles.row}>
					<Field label="Quiet days" htmlFor="succession-quiet">
						<input
							id="succession-quiet"
							className={controlClass}
							inputMode="decimal"
							value={quietDays}
							onChange={(e) => setQuietDays(e.target.value)}
						/>
					</Field>
					<Field label="Days to object" htmlFor="succession-wait">
						<input
							id="succession-wait"
							className={controlClass}
							inputMode="decimal"
							value={waitDays}
							onChange={(e) => setWaitDays(e.target.value)}
						/>
					</Field>
				</div>
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<button type="submit" className={buttonClass("secondary")} disabled={busy}>
					Save successor
				</button>
			</form>
		</Card>
	);
}
