import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PeopleCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/** Members and their roles; adding, removing and role changes are proposals like any rule change. */
export function PeopleCard({ account }: { account: OrgAccount }) {
	const { workspace, personOf, dataSource, me } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { org } = account;
	const onTestnet = dataSource.kind === "testnet";
	const outside = workspace.people.filter((p) => !org.members.some((m) => m.personId === p.id));
	const lowestRole = org.roles.at(-1)?.id ?? "";
	const [inviteId, setInviteId] = useState(onTestnet ? "" : (outside[0]?.id ?? ""));
	const [inviteRole, setInviteRole] = useState(lowestRole);

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
						<li key={member.personId} className={styles.person}>
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
									propose({ type: "changeRole", personId: member.personId, roleId: e.target.value })
								}
							>
								{roleOptions}
							</select>
							<button
								type="button"
								className={buttonClass("secondary")}
								disabled={busy}
								onClick={() => propose({ type: "removeMember", personId: member.personId })}
							>
								Remove
							</button>
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
							hint="Ask the person for the ID on their pass (starts with C). They sign in with their own passkey."
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
