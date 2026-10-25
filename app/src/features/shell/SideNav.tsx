import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { inboxFor } from "../../domain/inbox.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { ChevronDownIcon } from "../../ui/icons.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { organizationGroup, primaryItems, utilityItems } from "./navigation.tsx";
import { OrgSwitcher } from "./OrgSwitcher.tsx";
import styles from "./SideNav.module.css";

type SideNavProps = {
	/** Called after a link is followed, so a drawer can close itself. */
	onNavigate?: () => void;
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.item} ${styles.active}` : styles.item;

/**
 * The application panel: brand header, the organization switcher, everyday items, the
 * collapsible "Organization" section, and utility links at the bottom. Used as the fixed
 * sidebar on wide screens and inside the drawer on phones.
 */
export function SideNav({ onNavigate }: SideNavProps) {
	const { workspace, me } = useWorkspace();
	const location = useLocation();
	const waiting = inboxFor(workspace, me.id).length;
	const inOrganization =
		location.pathname.startsWith(organizationGroup.prefix) ||
		organizationGroup.children.some((c) => c.to.split("#")[0] === location.pathname);
	const [expanded, setExpanded] = useState(inOrganization);
	const open = expanded || inOrganization;
	const current = `${location.pathname}${location.hash}`;

	return (
		<div className={styles.panel}>
			<header className={styles.brand}>
				<Link to="/" className={styles.brandLink} onClick={onNavigate}>
					<BrandMark />
				</Link>
			</header>

			<div className={styles.body}>
				<OrgSwitcher />

				<nav aria-label="Main" className={styles.nav}>
					{primaryItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.to === "/app"}
							className={linkClass}
							onClick={onNavigate}
						>
							{item.icon}
							<span className={styles.label}>{item.label}</span>
							{item.to === "/app/inbox" && waiting > 0 && (
								<span className={styles.badge}>{waiting}</span>
							)}
						</NavLink>
					))}

					<button
						type="button"
						className={inOrganization ? `${styles.item} ${styles.active}` : styles.item}
						aria-expanded={open}
						aria-controls="nav-organization"
						onClick={() => setExpanded((value) => !value)}
					>
						{organizationGroup.icon}
						<span className={styles.label}>{organizationGroup.label}</span>
						<span className={open ? `${styles.chevron} ${styles.chevronUp}` : styles.chevron}>
							<ChevronDownIcon />
						</span>
					</button>
					{open && (
						<ul id="nav-organization" className={styles.children}>
							{organizationGroup.children.map((child) => {
								const [path, hash] = child.to.split("#");
								const isCurrent = hash
									? current === child.to
									: location.pathname === path && location.hash === "";
								return (
									<li key={child.to}>
										<Link
											to={child.to}
											className={isCurrent ? `${styles.child} ${styles.childActive}` : styles.child}
											aria-current={isCurrent ? "page" : undefined}
											onClick={onNavigate}
										>
											{child.label}
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</nav>

				<nav aria-label="More" className={`${styles.nav} ${styles.utility}`}>
					{utilityItems.map((item) => (
						<NavLink key={item.to} to={item.to} end className={linkClass} onClick={onNavigate}>
							{item.to === "/app/me" ? (
								<Avatar name={me.name} imageUrl={me.avatarUrl} size="sm" shape="circle" />
							) : (
								item.icon
							)}
							<span className={styles.label}>{item.to === "/app/me" ? me.name : item.label}</span>
						</NavLink>
					))}
				</nav>
			</div>
		</div>
	);
}
