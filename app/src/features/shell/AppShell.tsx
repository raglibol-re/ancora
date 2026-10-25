import { Link, NavLink, Outlet } from "react-router";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { PlusIcon, SettingsIcon } from "../../ui/icons.tsx";
import styles from "./AppShell.module.css";
import { navItems } from "./navigation.tsx";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

export function AppShell() {
	return (
		<div className={styles.shell}>
			<aside className={styles.sidebar}>
				<Link to="/app" className={styles.brandLink}>
					<BrandMark />
				</Link>
				<nav aria-label="Main">
					{navItems.map((item) => (
						<NavLink key={item.to} to={item.to} end className={navLinkClass}>
							{item.icon}
							{item.label}
						</NavLink>
					))}
				</nav>
				<NavLink to="/app/new" className={navLinkClass}>
					<PlusIcon />
					New organization
				</NavLink>
			</aside>

			<header className={styles.mobileHeader}>
				<Link to="/app" className={styles.brandLink}>
					<BrandMark size={28} />
				</Link>
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
						<NavLink key={item.to} to={item.to} end className={navLinkClass}>
							{item.icon}
							<span>{item.label}</span>
						</NavLink>
					))}
			</nav>
		</div>
	);
}
