import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { Role } from "../../domain/rules/model.ts";
import { customRole, MAX_ROLES, roleIdFromName, validateRoles } from "../../domain/rules/roles.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import styles from "./RolesCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * The organization's own roles, highest first. A higher role can approve wherever a lower one
 * is asked for. Edits are drafted here and saved as one rule change (directly in the setup
 * phase, otherwise a request under the strictest tier); the contract checks the same limits.
 */
export function RolesCard({ account }: { account: OrgAccount }) {
	const { propose, busy } = useProposeChange(account);
	const { org, onchain } = account;
	const [draft, setDraft] = useState<readonly Role[]>(org.roles);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (onchain && !onchain.customRoles) {
		return (
			<Card title="Roles">
				<p className={styles.muted}>
					{org.roles.map((role) => role.name).join(", ")}. This organization was created before
					custom roles existed; organizations created from 28 Oct 2026 can add, reorder and remove
					their own roles.
				</p>
			</Card>
		);
	}

	const holders = (roleId: string) => org.members.filter((m) => m.roleId === roleId).length;
	const changed = draft.map((r) => r.id).join() !== org.roles.map((r) => r.id).join();
	const verdict = validateRoles(org, draft);

	const move = (index: number, by: -1 | 1) => {
		const next = [...draft];
		const [role] = next.splice(index, 1);
		if (role) next.splice(index + by, 0, role);
		setDraft(next);
	};

	const add = (event: FormEvent) => {
		event.preventDefault();
		const id = roleIdFromName(name);
		if (!id) {
			setError("Name the role with letters or digits, like coach or project lead.");
			return;
		}
		if (draft.some((role) => role.id === id)) {
			setError("This organization already has that role.");
			return;
		}
		if (draft.length >= MAX_ROLES) {
			setError(`An organization has at most ${MAX_ROLES} roles.`);
			return;
		}
		setError(null);
		setName("");
		setDraft([...draft, customRole(id)]);
	};

	const save = async () => {
		const result = await propose({ type: "setRoles", roles: draft });
		if (result?.ok) setError(null);
	};

	return (
		<Card title="Roles">
			<p className={styles.muted}>
				Highest first. A higher role can approve wherever a lower one is asked for. Changing the
				roles is a rule change like any other, and the rules document's fingerprint covers them.
			</p>
			<ol className={styles.list}>
				{draft.map((role, index) => {
					const count = holders(role.id);
					return (
						<li key={role.id} className={styles.role}>
							<span className={styles.rank}>{index + 1}</span>
							<span className={styles.name}>
								{role.name}
								<span className={styles.meta}>
									{count === 0 ? "nobody yet" : `${count} ${count === 1 ? "person" : "people"}`}
								</span>
							</span>
							<span className={styles.actions}>
								<button
									type="button"
									className={styles.iconButton}
									disabled={index === 0}
									aria-label={`Move ${role.name} up`}
									onClick={() => move(index, -1)}
								>
									↑
								</button>
								<button
									type="button"
									className={styles.iconButton}
									disabled={index === draft.length - 1}
									aria-label={`Move ${role.name} down`}
									onClick={() => move(index, 1)}
								>
									↓
								</button>
								<button
									type="button"
									className={styles.iconButton}
									disabled={count > 0 || draft.length === 1}
									aria-label={`Remove ${role.name}`}
									title={count > 0 ? "Give these people another role first." : undefined}
									onClick={() => setDraft(draft.filter((r) => r.id !== role.id))}
								>
									×
								</button>
							</span>
						</li>
					);
				})}
			</ol>
			<form className={styles.form} onSubmit={add}>
				<Field label="New role" htmlFor="role-name">
					<input
						id="role-name"
						className={controlClass}
						value={name}
						placeholder="Coach"
						autoComplete="off"
						onChange={(e) => setName(e.target.value)}
					/>
				</Field>
				<button type="submit" className={buttonClass("secondary")} disabled={!name.trim()}>
					Add role
				</button>
			</form>
			{(error ?? (changed && !verdict.ok ? verdict.error.message : null)) && (
				<p className={styles.error} role="alert">
					{error ?? (!verdict.ok ? verdict.error.message : null)}
				</p>
			)}
			{changed && (
				<div className={styles.save}>
					<button
						type="button"
						className={buttonClass()}
						disabled={busy || !verdict.ok}
						onClick={() => void save()}
					>
						Save roles
					</button>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => setDraft(org.roles)}
					>
						Discard
					</button>
				</div>
			)}
		</Card>
	);
}
