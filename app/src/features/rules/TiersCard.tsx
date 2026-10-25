import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import type { Policy } from "../../domain/rules/model.ts";
import { validatePolicy } from "../../domain/rules/policy.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { describeRequirements } from "../requests/describe.ts";
import styles from "./TiersCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

const toInput = (cents: number) => String(cents / 100);

/** Edit tier limits, objection windows and the seal threshold; saving proposes a rule change. */
export function TiersCard({ account }: { account: OrgAccount }) {
	const { policy } = account.org;
	const { propose, busy } = useProposeChange(account);
	const [limits, setLimits] = useState(() =>
		policy.tiers.map((t) => (t.upTo === null ? "" : toInput(t.upTo))),
	);
	const [windows, setWindows] = useState(() =>
		policy.tiers.map((t) => String(t.objectionWindowHours)),
	);
	const [seal, setSeal] = useState(() => toInput(policy.sealThreshold));
	const [error, setError] = useState<string | null>(null);

	const set = (list: string[], index: number, value: string) =>
		list.map((v, i) => (i === index ? value : v));

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const next: Policy = {
			...policy,
			tiers: policy.tiers.map((tier, i) => ({
				...tier,
				upTo: tier.upTo === null ? null : (parseAmountInput(limits[i] ?? "") ?? Number.NaN),
				objectionWindowHours: Number(windows[i]),
			})),
			sealThreshold: parseAmountInput(seal) ?? Number.NaN,
		};
		const valid = validatePolicy(next, account.org.roles);
		if (!valid.ok) {
			setError(valid.error.message);
			return;
		}
		setError(null);
		await propose({ type: "updatePolicy", policy: next });
	};

	return (
		<Card title="Approval tiers">
			<form className={styles.form} onSubmit={submit}>
				<ol className={styles.tiers}>
					{policy.tiers.map((tier, i) => {
						const previous = policy.tiers[i - 1];
						return (
							<li key={tier.upTo ?? "unbounded"} className={styles.tier}>
								<div className={styles.range}>
									{tier.upTo === null ? (
										<span>Above {formatMoney(previous?.upTo ?? 0)}</span>
									) : (
										<label>
											Up to €
											<input
												className={`${controlClass} ${styles.small}`}
												inputMode="decimal"
												aria-label={`Tier ${i + 1} upper limit in euros`}
												value={limits[i] ?? ""}
												onChange={(e) => setLimits(set(limits, i, e.target.value))}
											/>
										</label>
									)}
								</div>
								<p className={styles.needs}>
									Needs {describeRequirements(account.org, tier.approvals)}
								</p>
								<label className={styles.window}>
									Objection window
									<input
										className={`${controlClass} ${styles.tiny}`}
										inputMode="numeric"
										aria-label={`Tier ${i + 1} objection window in hours`}
										value={windows[i] ?? ""}
										onChange={(e) => setWindows(set(windows, i, e.target.value))}
									/>
									hours
								</label>
							</li>
						);
					})}
				</ol>
				<label className={styles.seal}>
					Security seal from €
					<input
						className={`${controlClass} ${styles.small}`}
						inputMode="decimal"
						value={seal}
						onChange={(e) => setSeal(e.target.value)}
					/>
				</label>
				{account.org.policy.newRecipientApprovals.length > 0 && (
					<p className={styles.needs}>
						First payment to a new recipient: at least{" "}
						{describeRequirements(account.org, account.org.policy.newRecipientApprovals)}.
					</p>
				)}
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<button type="submit" className={buttonClass("secondary")} disabled={busy}>
					Save changes
				</button>
			</form>
		</Card>
	);
}
