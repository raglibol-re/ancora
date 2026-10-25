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
	const { workspace, personName, dataSource, me } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { org } = account;
	const outside = workspace.people.filter((p) => !org.members.some((m) => m.personId === p.id));
	const lowestRole = org.roles.at(-1)?.id ?? "";
	const [inviteId, setInviteId] = useState(outside[0]?.id ?? "");
	const [inviteRole, setInviteRole] = useState(lowestRole);

	const invite = async (event: FormEvent) => {
		event.preventDefault();
		if (!inviteId) return;
		await propose({ type: "addMember", personId: inviteId, roleId: inviteRole });
	};

	const roleOptions = org.roles.map((role) => (
		<option key={role.id} value={role.id}>
			{role.name}
		</option>
	));

	return (
		<Card
			title="People"
			action={dataSource.kind === "sample" ? <SimulatedTag label="Sample directory" /> : null}
		>
			<ul className={styles.list}>
				{org.members.map((member) => (
					<li key={member.personId} className={styles.person}>
						<Avatar name={personName(member.personId)} shape="circle" />
						<span className={styles.name}>
							{personName(member.personId)}
							{member.personId === me.id && <span className={styles.you}> (you)</span>}
						</span>
						<select
							className={controlClass}
							aria-label={`Role of ${personName(member.personId)}`}
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
				))}
			</ul>

			{outside.length > 0 && (
				<form className={styles.invite} onSubmit={invite}>
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
					<button type="submit" className={buttonClass()} disabled={busy}>
						Add person
					</button>
				</form>
			)}
		</Card>
	);
}
