import { type CSSProperties, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { inboxFor } from "../../domain/inbox.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { CloseIcon, MenuIcon } from "../../ui/icons.tsx";
import { ClaimBanner } from "../lifeline/ClaimBanner.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./AppShell.module.css";
import { DataSourceBanner } from "./DataSourceBanner.tsx";
import { tabBarItems } from "./navigation.tsx";
import { OrgSwitcher } from "./OrgSwitcher.tsx";
import { SideNav } from "./SideNav.tsx";

const tabClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab;

/**
 * Wide screens: a fixed-width panel on the left, content on the right. Phones: a header with
 * the organization switcher and a menu button that opens the same panel as a drawer, plus a
 * bottom tab bar for the everyday items.
 */
export function AppShell() {
	const { workspace, me } = useWorkspace();
	const location = useLocation();
	const waiting = inboxFor(workspace, me.id).length;
	const drawer = useRef<HTMLDialogElement>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	// The banners stay pinned; the side panel and the phone header sit right below them.
	const topbar = useRef<HTMLDivElement>(null);
	const [topbarHeight, setTopbarHeight] = useState(0);

	useEffect(() => {
		const element = topbar.current;
		if (!element) return;
		const update = () => setTopbarHeight(Math.round(element.getBoundingClientRect().height));
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const dialog = drawer.current;
		if (!dialog) return;
		if (drawerOpen && !dialog.open) dialog.showModal();
		if (!drawerOpen && dialog.open) dialog.close();
	}, [drawerOpen]);

	// A route change closes the drawer, whatever opened it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the location is the trigger, not a value we read.
	useEffect(() => {
		setDrawerOpen(false);
	}, [location.pathname, location.hash]);

	return (
		<div
			className={styles.frame}
			style={{ "--topbar-height": `${topbarHeight}px` } as CSSProperties}
		>
			<div ref={topbar} className={styles.topbar}>
				<DataSourceBanner />
				<ClaimBanner />
			</div>
			<div className={styles.shell}>
				<aside className={styles.sidebar}>
					<SideNav />
				</aside>

				<header className={styles.mobileHeader}>
					<button
						type="button"
						className={styles.iconButton}
						aria-label="Open menu"
						onClick={() => setDrawerOpen(true)}
					>
						<MenuIcon />
					</button>
					<OrgSwitcher />
					<NavLink to="/app/me" className={styles.iconLink} aria-label="Your pass">
						<Avatar name={me.name} imageUrl={me.avatarUrl} size="md" shape="circle" />
					</NavLink>
				</header>

				<dialog
					ref={drawer}
					className={styles.drawer}
					aria-label="Menu"
					onClose={() => setDrawerOpen(false)}
				>
					<button
						type="button"
						className={styles.drawerClose}
						aria-label="Close menu"
						onClick={() => setDrawerOpen(false)}
					>
						<CloseIcon />
					</button>
					{drawerOpen && <SideNav onNavigate={() => setDrawerOpen(false)} />}
				</dialog>

				<main key={location.pathname} className={styles.content}>
					<Outlet />
				</main>

				<nav className={styles.tabBar} aria-label="Main">
					{tabBarItems.map((item) => (
						<NavLink key={item.to} to={item.to} end={item.to === "/app"} className={tabClass}>
							{item.icon}
							<span className={styles.tabText}>
								{item.label}
								{item.to === "/app/inbox" && waiting > 0 && (
									<span className={styles.badge}>{waiting}</span>
								)}
							</span>
						</NavLink>
					))}
				</nav>
			</div>
		</div>
	);
}
