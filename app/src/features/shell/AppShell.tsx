import { Link, NavLink, Outlet } from "react-router";
import { inboxFor } from "../../domain/inbox.ts";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { SettingsIcon } from "../../ui/icons.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AppShell.module.css";
import { DataSourceBanner } from "./DataSourceBanner.tsx";
import { navItems } from "./navigation.tsx";
import { OrgSwitcher } from "./OrgSwitcher.tsx";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

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
				</aside>

				<header className={styles.mobileHeader}>
					<OrgSwitcher />
					<NavLink to="/app/settings" className={styles.iconLink} aria-label="Settings">
						<SettingsIcon />
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
