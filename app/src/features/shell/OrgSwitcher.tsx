import { useRef } from "react";
import { Link } from "react-router";
import { inboxFor } from "../../domain/inbox.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { ChevronDownIcon, PlusIcon, SettingsIcon } from "../../ui/icons.tsx";
import { roleLabel } from "../requests/describe.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./OrgSwitcher.module.css";

/** Switch between the organizations this person belongs to; each shows their role and open items. */
export function OrgSwitcher() {
	const { workspace, me, myAccounts, active, updatePreferences } = useWorkspace();
	const details = useRef<HTMLDetailsElement>(null);
	const waiting = inboxFor(workspace, me.id);
	const close = () => details.current?.removeAttribute("open");
	const myRole = (orgId: string) => {
		const account = myAccounts.find((a) => a.org.id === orgId);
		const member = account?.org.members.find((m) => m.personId === me.id);
		return account && member ? roleLabel(account.org, member.roleId) : "";
	};

	return (
		<details ref={details} className={styles.switcher}>
			<summary className={styles.current}>
				{active ? (
					<>
						<Avatar name={active.org.name} imageUrl={active.logoUrl} />
						<span className={styles.label}>
							<span className={styles.name}>{active.org.name}</span>
							<span className={styles.role}>{myRole(active.org.id)}</span>
						</span>
					</>
				) : (
					<span className={styles.name}>No organization yet</span>
				)}
				<ChevronDownIcon />
			</summary>
			<div className={styles.menu}>
				<ul>
					{myAccounts.map((account) => {
						const open = waiting.filter((w) => w.account.org.id === account.org.id).length;
						return (
							<li key={account.org.id}>
								<button
									type="button"
									className={styles.option}
									aria-current={account.org.id === active?.org.id}
									onClick={() => {
										updatePreferences({ activeOrgId: account.org.id });
										close();
									}}
								>
									<Avatar name={account.org.name} imageUrl={account.logoUrl} size="sm" />
									<span className={styles.label}>
										<span className={styles.name}>{account.org.name}</span>
										<span className={styles.role}>{myRole(account.org.id)}</span>
									</span>
									{open > 0 && <span className={styles.badge}>{open}</span>}
								</button>
							</li>
						);
					})}
				</ul>
				<Link to="/app/new" className={styles.option} onClick={close}>
					<PlusIcon />
					New organization
				</Link>
				{active && (
					<Link to="/app/settings" className={styles.option} onClick={close}>
						<SettingsIcon />
						Organization settings
					</Link>
				)}
			</div>
		</details>
	);
}
