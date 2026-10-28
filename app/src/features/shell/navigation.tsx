import type { ReactNode } from "react";
import {
	ActivityIcon,
	ApprovalsIcon,
	CompassIcon,
	FingerprintIcon,
	HomeIcon,
	InboxIcon,
	OrganizationIcon,
	RulesIcon,
	SendIcon,
	SignalIcon,
} from "../../ui/icons.tsx";

export type NavItem = {
	to: string;
	label: string;
	icon: ReactNode;
	/** Shown in the mobile bottom tab bar (max five); everything shows in the side panel. */
	inTabBar: boolean;
};

/** A parent entry whose children are plain links below it (the panel's collapsible section). */
export type NavGroup = {
	label: string;
	icon: ReactNode;
	/** Route prefix that marks the group active. */
	prefix: string;
	children: readonly { to: string; label: string }[];
};

/** Everyday money work, top of the panel. */
export const primaryItems: readonly NavItem[] = [
	{ to: "/app", label: "Overview", icon: <HomeIcon />, inTabBar: true },
	{ to: "/app/inbox", label: "Inbox", icon: <InboxIcon />, inTabBar: true },
	{ to: "/app/pay", label: "Send", icon: <SendIcon />, inTabBar: true },
	{ to: "/app/approvals", label: "Approvals", icon: <ApprovalsIcon />, inTabBar: true },
	{ to: "/app/activity", label: "Activity", icon: <ActivityIcon />, inTabBar: false },
];

/** How the organization is set up: rules, budgets, people, settings. */
export const organizationGroup: NavGroup = {
	label: "Organization",
	icon: <OrganizationIcon />,
	prefix: "/app/rules",
	children: [
		{ to: "/app/rules", label: "Approval rules" },
		{ to: "/app/rules#budgets", label: "Budgets" },
		{ to: "/app/rules#people", label: "People & limits" },
		{ to: "/app/payees", label: "Address book" },
		{ to: "/app/links", label: "Payment links" },
		{ to: "/app/settings", label: "Settings & logo" },
	],
};

/** The tab bar keeps Rules as its fifth entry so phones reach the organization in one tap. */
export const tabBarItems: readonly NavItem[] = [
	...primaryItems.filter((item) => item.inTabBar),
	{ to: "/app/rules", label: "Rules", icon: <RulesIcon />, inTabBar: true },
];

/** Utility links at the bottom of the panel. */
export const utilityItems: readonly NavItem[] = [
	{ to: "/app/me", label: "Your pass", icon: <FingerprintIcon />, inTabBar: false },
	{ to: "/app/me#data-source", label: "Network & data", icon: <SignalIcon />, inTabBar: false },
	{ to: "/", label: "About ancora", icon: <CompassIcon />, inTabBar: false },
];
