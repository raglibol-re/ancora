import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { Role } from "../../domain/rules/model.ts";
import { customRole, MAX_ROLES, roleIdFromName, validateRoles } from "../../domain/rules/roles.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./RolesCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * The organization's own roles, highest first. A higher role can approve wherever a lower one
 * is asked for. Edits are drafted here and saved as one rule change (directly in the setup
 * phase, otherwise a request under the strictest tier); the contract checks the same limits.
 */
export function RolesCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const { propose, busy } = useProposeChange(account);
	const { org, onchain } = account;
	const [draft, setDraft] = useState<readonly Role[]>(org.roles);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	if (onchain && !onchain.customRoles) {
		return (
			<Card title={t("Roles")}>
				<p className={styles.muted}>
					{org.roles.map((role) => t(role.name)).join(", ")}
					{t(
						". This organization was created before custom roles existed; organizations created from 28 Oct 2026 can add, reorder and remove their own roles.",
					)}
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
			setError(t("Name the role with letters or digits, like coach or project lead."));
			return;
		}
		if (draft.some((role) => role.id === id)) {
			setError(t("This organization already has that role."));
			return;
		}
		if (draft.length >= MAX_ROLES) {
			setError(t("An organization has at most {count} roles.", { count: MAX_ROLES }));
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
		<Card title={t("Roles")}>
			<p className={styles.muted}>
				{t(
					"Highest first. A higher role can approve wherever a lower one is asked for. Changing the roles is a rule change like any other, and the rules document's fingerprint covers them.",
				)}
			</p>
			<ol className={styles.list}>
				{draft.map((role, index) => {
					const count = holders(role.id);
					return (
						<li key={role.id} className={styles.role}>
							<span className={styles.rank}>{index + 1}</span>
							<span className={styles.name}>
								{t(role.name)}
								<span className={styles.meta}>
									{count === 0 ? t("nobody yet") : `${count} ${count === 1 ? "person" : "people"}`}
								</span>
							</span>
							<span className={styles.actions}>
								<button
									type="button"
									className={styles.iconButton}
									disabled={index === 0}
									aria-label={t("Move {name} up", { name: role.name })}
									onClick={() => move(index, -1)}
								>
									↑
								</button>
								<button
									type="button"
									className={styles.iconButton}
									disabled={index === draft.length - 1}
									aria-label={t("Move {name} down", { name: role.name })}
									onClick={() => move(index, 1)}
								>
									↓
								</button>
								<button
									type="button"
									className={styles.iconButton}
									disabled={count > 0 || draft.length === 1}
									aria-label={t("Remove {name}", { name: role.name })}
									title={count > 0 ? t("Give these people another role first.") : undefined}
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
				<Field label={t("New role")} htmlFor="role-name">
					<input
						id="role-name"
						className={controlClass}
						value={name}
						placeholder={t("Coach")}
						autoComplete="off"
						onChange={(e) => setName(e.target.value)}
					/>
				</Field>
				<button type="submit" className={buttonClass("secondary")} disabled={!name.trim()}>
					{t("Add role")}
				</button>
			</form>
			{(error ?? (changed && !verdict.ok ? verdict.error.message : null)) && (
				<p className={styles.error} role="alert">
					{t(error ?? (!verdict.ok ? verdict.error.message : ""))}
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
						{t("Save roles")}
					</button>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy}
						onClick={() => setDraft(org.roles)}
					>
						{t("Discard")}
					</button>
				</div>
			)}
		</Card>
	);
}
