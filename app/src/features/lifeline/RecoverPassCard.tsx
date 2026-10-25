import { type FormEvent, useState } from "react";
import { shortAddress } from "../../domain/account.ts";
import { type ClaimStatus, claimProgress, describeTimeLeft } from "../../domain/lifeline.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Lifeline.module.css";

/**
 * From a new pass: follow the recovery of the old one and complete it once the guardians have
 * confirmed and the waiting period is over.
 */
export function RecoverPassCard() {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();
	const [oldId, setOldId] = useState("");
	const [status, setStatus] = useState<ClaimStatus | null>(null);
	const [checked, setChecked] = useState<string | null>(null);
	const [done, setDone] = useState<{ recovered: string[]; skipped: string[] } | null>(null);

	const check = async (event?: FormEvent) => {
		event?.preventDefault();
		const id = oldId.trim();
		if (!id) return;
		const result = await run(() => dataSource.lifeline.claimOf(id));
		if (result?.ok) {
			setStatus(result.value);
			setChecked(id);
			setDone(null);
		}
	};

	const finish = async () => {
		if (!checked) return;
		const result = await run(() => dataSource.lifeline.finishClaim(checked), {
			success: "Your positions moved to this pass.",
		});
		if (result?.ok) {
			setDone({ recovered: result.value.recovered, skipped: result.value.skipped });
			void check();
		}
	};

	const claim = status?.claim ?? null;
	const plan = status?.plan ?? null;
	const progress = claim && plan ? claimProgress(plan, claim, Date.now()) : null;
	const forMe = claim?.successor === me.id;

	return (
		<Card title="Recover an old pass">
			<p className={styles.muted}>
				Lost your previous pass? Give its ancora ID to the guardians you had named; they confirm
				this new pass ({shortAddress(me.id)}). Once enough have confirmed and the waiting period is
				over, complete the recovery here: your positions in every organization move to this pass.
			</p>
			<form className={styles.row} onSubmit={check}>
				<Field label="Old ancora ID" htmlFor="old-pass">
					<input
						id="old-pass"
						className={controlClass}
						value={oldId}
						placeholder="C…"
						spellCheck={false}
						autoComplete="off"
						onChange={(e) => setOldId(e.target.value)}
					/>
				</Field>
				<div>
					<button
						type="submit"
						className={buttonClass("secondary")}
						disabled={busy || !oldId.trim()}
					>
						Check status
					</button>
				</div>
			</form>
			{status && checked && (
				<div className={styles.form} aria-live="polite">
					{status.recoveredTo && (
						<p className={styles.muted}>
							This pass was already recovered to {shortAddress(status.recoveredTo)}
							{status.recoveredTo === me.id ? " (you)" : ""}.
						</p>
					)}
					{!status.recoveredTo && !plan && (
						<p className={styles.muted}>
							{personName(checked)} never set up Lifeline, so this pass can't be recovered. Ask the
							organizations to invite your new pass instead.
						</p>
					)}
					{!status.recoveredTo && plan && !claim && (
						<p className={styles.muted}>
							No recovery started yet. One of the {plan.guardians.length} guardians has to start it
							with your new ID.
						</p>
					)}
					{!status.recoveredTo && plan && claim && progress && (
						<p className={styles.muted}>
							Claim for {shortAddress(claim.successor)}
							{forMe ? " (this pass)" : " (not this pass)"}: {progress.confirmed} of{" "}
							{progress.needed} guardians confirmed
							{progress.confirmed >= progress.needed && !progress.ready
								? `; waiting period ends ${describeTimeLeft(progress.waitLeftMs)}`
								: ""}
							.
						</p>
					)}
					{(status.recoveredTo === me.id || (progress?.ready && forMe)) && (
						<div>
							<button type="button" className={buttonClass()} disabled={busy} onClick={finish}>
								{status.recoveredTo ? "Hand over remaining positions" : "Complete recovery"}
							</button>
						</div>
					)}
					{done && (
						<p className={styles.muted}>
							Handed over in {done.recovered.length} organization
							{done.recovered.length === 1 ? "" : "s"}
							{done.skipped.length > 0
								? `; ${done.skipped.length} older organization${done.skipped.length === 1 ? "" : "s"} can't hand over positions (ask them to invite this pass)`
								: ""}
							.
						</p>
					)}
				</div>
			)}
		</Card>
	);
}
