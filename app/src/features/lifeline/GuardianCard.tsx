import { type FormEvent, useState } from "react";
import { shortAddress } from "../../domain/account.ts";
import {
	claimProgress,
	describeTimeLeft,
	describeWait,
	type LifelineOverview,
	type Protected,
} from "../../domain/lifeline.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Lifeline.module.css";

type GuardianCardProps = {
	overview: LifelineOverview | null;
	onChanged: () => void;
};

/** The people who named me as a guardian: start or confirm the recovery of their pass. */
export function GuardianCard({ overview, onChanged }: GuardianCardProps) {
	const wards = overview?.protecting ?? [];
	if (wards.length === 0) return null;
	return (
		<Card title="People you protect">
			<p className={styles.muted}>
				They named you as a guardian. If one of them loses their pass, they create a new one and
				tell you its ID; you confirm it here. Verify in person or by voice that it is really them: a
				guardian's confirmation is what makes a recovery possible.
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
			success: `Recovery of ${person.name}'s pass started; your confirmation counts.`,
		});
		if (result?.ok) {
			setStarting(false);
			setSuccessor("");
			onChanged();
		}
	};

	const confirm = async () => {
		const result = await run(() => dataSource.lifeline.approveClaim(ward.personId, me.id), {
			success: `You confirmed ${person.name}'s new pass.`,
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
						· {ward.plan.threshold} of {ward.plan.guardians.length} confirm ·{" "}
						{describeWait(ward.plan.waitSeconds)}
					</span>
				</span>
			</div>
			{claim && progress ? (
				<>
					<p className={styles.muted}>
						Recovery in progress: new pass {shortAddress(claim.successor)}, confirmed by{" "}
						{progress.confirmed} of {progress.needed}
						{progress.ready
							? ". Ready: the new pass can complete it."
							: progress.confirmed >= progress.needed
								? `. Waiting period ends ${describeTimeLeft(progress.waitLeftMs)}.`
								: "."}
					</p>
					{!confirmedByMe && (
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={confirm}>
								Confirm this new pass
							</button>
						</div>
					)}
				</>
			) : starting ? (
				<form className={styles.form} onSubmit={start}>
					<Field
						label={`${person.name}'s new ancora ID`}
						htmlFor={`successor-${ward.personId}`}
						hint="Ask them to read it from their new pass (starts with C). Check it's really them."
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
							Start recovery
						</button>
						<button type="button" className={styles.linkButton} onClick={() => setStarting(false)}>
							Cancel
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
						They lost their pass
					</button>
				</div>
			)}
		</li>
	);
}
