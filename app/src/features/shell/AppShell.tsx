import { Link, NavLink, Outlet } from "react-router";
import { inboxFor } from "../../domain/inbox.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { ClaimBanner } from "../lifeline/ClaimBanner.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AppShell.module.css";
import { DataSourceBanner } from "./DataSourceBanner.tsx";
import { navItems } from "./navigation.tsx";
import { OrgSwitcher } from "./OrgSwitcher.tsx";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
const profileLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.profileLink} ${styles.active}` : styles.profileLink;

export function AppShell() {
	const { workspace, me } = useWorkspace();
	const waiting = inboxFor(workspace, me.id).length;

	const label = (to: string, text: string) =>
		to === "/app/inbox" && waiting > 0 ? (
			<>
				{text}
				<span className={styles.badge}>{waiting}</span>
			</>
		) : (
			text
		);

	return (
		<div className={styles.frame}>
			<DataSourceBanner />
			<ClaimBanner />
			<div className={styles.shell}>
				<aside className={styles.sidebar}>
					<Link to="/" className={styles.brandLink}>
						<BrandMark />
					</Link>
					<OrgSwitcher />
					<nav aria-label="Main">
						{navItems.map((item) => (
							<NavLink key={item.to} to={item.to} end={item.to === "/app"} className={navLinkClass}>
								{item.icon}
								<span className={styles.navText}>{label(item.to, item.label)}</span>
							</NavLink>
						))}
					</nav>
					<NavLink to="/app/me" className={profileLinkClass}>
						<Avatar name={me.name} imageUrl={me.avatarUrl} size="md" shape="circle" />
						<span className={styles.profileText}>
							<span className={styles.profileName}>{me.name}</span>
							<span className={styles.profileHint}>Your pass</span>
						</span>
					</NavLink>
				</aside>

				<header className={styles.mobileHeader}>
					<OrgSwitcher />
					<NavLink to="/app/me" className={styles.iconLink} aria-label="Your pass">
						<Avatar name={me.name} imageUrl={me.avatarUrl} size="md" shape="circle" />
					</NavLink>
				</header>

				<main className={styles.content}>
					<Outlet />
				</main>

				<nav className={styles.tabBar} aria-label="Main">
					{navItems
						.filter((item) => item.inTabBar)
						.map((item) => (
							<NavLink key={item.to} to={item.to} end={item.to === "/app"} className={navLinkClass}>
								{item.icon}
								<span className={styles.navText}>{label(item.to, item.label)}</span>
							</NavLink>
						))}
				</nav>
			</div>
		</div>
	);
}
