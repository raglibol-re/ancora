import type { ReactNode } from "react";
import {
	ApprovalsIcon,
	HomeIcon,
	InboxIcon,
	RulesIcon,
	SendIcon,
	SettingsIcon,
} from "../../ui/icons.tsx";

export type NavItem = {
	to: string;
	label: string;
	icon: ReactNode;
	/** Shown in the mobile bottom tab bar (max five); everything shows in the sidebar. */
	inTabBar: boolean;
};

export const navItems: readonly NavItem[] = [
	{ to: "/app", label: "Overview", icon: <HomeIcon />, inTabBar: true },
	{ to: "/app/inbox", label: "Inbox", icon: <InboxIcon />, inTabBar: true },
	{ to: "/app/pay", label: "Send", icon: <SendIcon />, inTabBar: true },
	{ to: "/app/approvals", label: "Approvals", icon: <ApprovalsIcon />, inTabBar: true },
	{ to: "/app/rules", label: "Rules", icon: <RulesIcon />, inTabBar: true },
	{ to: "/app/settings", label: "Org settings", icon: <SettingsIcon />, inTabBar: false },
];
