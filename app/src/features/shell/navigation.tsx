import type { ReactNode } from "react";
import { msg } from "../../ui/i18n.ts";
import {
	ActivityIcon,
	ApprovalsIcon,
	CompassIcon,
	DealsIcon,
	FingerprintIcon,
	HomeIcon,
	InboxIcon,
	OrganizationIcon,
	RulesIcon,
	SealIcon,
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
	{ to: "/app", label: msg("Overview"), icon: <HomeIcon />, inTabBar: true },
	{ to: "/app/inbox", label: msg("Inbox"), icon: <InboxIcon />, inTabBar: true },
	{ to: "/app/pay", label: msg("Send"), icon: <SendIcon />, inTabBar: true },
	{ to: "/app/approvals", label: msg("Approvals"), icon: <ApprovalsIcon />, inTabBar: true },
	{ to: "/app/activity", label: msg("Activity"), icon: <ActivityIcon />, inTabBar: false },
	{ to: "/app/deals", label: msg("Deals"), icon: <DealsIcon />, inTabBar: false },
	{ to: "/app/pot", label: msg("Confidential pot"), icon: <SealIcon />, inTabBar: false },
];

/** How the organization is set up: rules, budgets, people, settings. */
export const organizationGroup: NavGroup = {
	label: msg("Organization"),
	icon: <OrganizationIcon />,
	prefix: "/app/rules",
	children: [
		{ to: "/app/rules", label: msg("Approval rules") },
		{ to: "/app/rules#budgets", label: msg("Budgets") },
		{ to: "/app/rules#people", label: msg("People & limits") },
		{ to: "/app/payees", label: msg("Address book") },
		{ to: "/app/links", label: msg("Payment links") },
		{ to: "/app/settings", label: msg("Settings & logo") },
	],
};

/** The tab bar keeps Rules as its fifth entry so phones reach the organization in one tap. */
export const tabBarItems: readonly NavItem[] = [
	...primaryItems.filter((item) => item.inTabBar),
	{ to: "/app/rules", label: msg("Rules"), icon: <RulesIcon />, inTabBar: true },
];

/** Utility links at the bottom of the panel. */
export const utilityItems: readonly NavItem[] = [
	{ to: "/app/me", label: msg("Your pass"), icon: <FingerprintIcon />, inTabBar: false },
	{
		to: "/app/me#data-source",
		label: msg("Network & data"),
		icon: <SignalIcon />,
		inTabBar: false,
	},
	{ to: "/app/audit", label: msg("Audit"), icon: <ApprovalsIcon />, inTabBar: false },
	{ to: "/", label: msg("About ancora"), icon: <CompassIcon />, inTabBar: false },
];
