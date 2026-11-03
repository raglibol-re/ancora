import { type FormEvent, useState } from "react";
import { shortAddress } from "../../domain/account.ts";
import { claimProgress, type LifelineOverview, type Protected } from "../../domain/lifeline.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Lifeline.module.css";
import { describeTimeLeft, describeWait } from "./lifelineTime.ts";

type GuardianCardProps = {
	overview: LifelineOverview | null;
	onChanged: () => void;
};

/** The people who named me as a guardian: start or confirm the recovery of their pass. */
export function GuardianCard({ overview, onChanged }: GuardianCardProps) {
	const t = useT();
	const wards = overview?.protecting ?? [];
	if (wards.length === 0) return null;
	return (
		<Card title={t("People you protect")}>
			<p className={styles.muted}>
				{t(
					"They named you as a guardian. If one of them loses their pass, they create a new one and tell you its ID; you confirm it here. Verify in person or by voice that it is really them: a guardian's confirmation is what makes a recovery possible.",
				)}
			</p>
			<ul className={styles.list}>
				{wards.map((ward) => (
					<WardRow key={ward.personId} ward={ward} onChanged={onChanged} />
				))}
			</ul>
		</Card>
	);
}

function WardRow({ ward, onChanged }: { ward: Protected; onChanged: () => void }) {
	const t = useT();
	const { dataSource, me, personOf } = useWorkspace();
	const { run, busy } = useCommand();
	const [starting, setStarting] = useState(false);
	const [successor, setSuccessor] = useState("");
	const person = personOf(ward.personId);
	const claim = ward.claim;
	const progress = claim ? claimProgress(ward.plan, claim, Date.now()) : null;
	const confirmedByMe = claim?.approvals.includes(me.id) ?? false;

	const start = async (event: FormEvent) => {
		event.preventDefault();
		const id = successor.trim();
		if (!id) return;
		const result = await run(() => dataSource.lifeline.startClaim(ward.personId, me.id, id), {
			success: t("Recovery of {name}'s pass started; your confirmation counts.", {
				name: person.name,
			}),
		});
		if (result?.ok) {
			setStarting(false);
			setSuccessor("");
			onChanged();
		}
	};

	const confirm = async () => {
		const result = await run(() => dataSource.lifeline.approveClaim(ward.personId, me.id), {
			success: t("You confirmed {name}'s new pass.", { name: person.name }),
		});
		if (result?.ok) onChanged();
	};

	return (
		<li className={styles.ward}>
			<div className={styles.wardHead}>
				<Avatar name={person.name} imageUrl={person.avatarUrl} shape="circle" size="sm" />
				<span className={styles.guardianName}>
					<strong>{person.name}</strong>
					<span className={styles.muted}>
						{" "}
						·{" "}
						{t("{needed} of {total} confirm · {wait}", {
							needed: ward.plan.threshold,
							total: ward.plan.guardians.length,
							wait: describeWait(ward.plan.waitSeconds),
						})}
					</span>
				</span>
			</div>
			{claim && progress ? (
				<>
					<p className={styles.muted}>
						{t("Recovery in progress: new pass {pass}, confirmed by {confirmed} of {needed}.", {
							pass: shortAddress(claim.successor),
							confirmed: progress.confirmed,
							needed: progress.needed,
						})}{" "}
						{progress.ready
							? t("Ready: the new pass can complete it.")
							: progress.confirmed >= progress.needed
								? t("The waiting period ends {when}.", {
										when: describeTimeLeft(progress.waitLeftMs),
									})
								: ""}
					</p>
					{!confirmedByMe && (
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={confirm}>
								{t("Confirm this new pass")}
							</button>
						</div>
					)}
				</>
			) : starting ? (
				<form className={styles.form} onSubmit={start}>
					<Field
						label={t("{name}'s new ancora ID", { name: person.name })}
						htmlFor={`successor-${ward.personId}`}
						hint={t(
							"Ask them to read it from their new pass (starts with C). Check it's really them.",
						)}
					>
						<input
							id={`successor-${ward.personId}`}
							className={controlClass}
							value={successor}
							placeholder="C…"
							spellCheck={false}
							autoComplete="off"
							onChange={(e) => setSuccessor(e.target.value)}
						/>
					</Field>
					<div className={styles.actions}>
						<button type="submit" className={buttonClass()} disabled={busy || !successor.trim()}>
							{t("Start recovery")}
						</button>
						<button type="button" className={styles.linkButton} onClick={() => setStarting(false)}>
							{t("Cancel")}
						</button>
					</div>
				</form>
			) : (
				<div>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => setStarting(true)}
					>
						{t("They lost their pass")}
					</button>
				</div>
			)}
		</li>
	);
}
