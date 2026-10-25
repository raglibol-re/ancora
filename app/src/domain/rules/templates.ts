import { euros } from "../money.ts";
import type { Policy, Role, TemplateId } from "./model.ts";

export type Template = {
	id: TemplateId;
	label: string;
	/** Highest role first. */
	roles: readonly Role[];
	policy: Policy;
};

export const templates: Readonly<Record<TemplateId, Template>> = {
	club: {
		id: "club",
		label: "Club or association",
		roles: [
			{ id: "treasurer", name: "treasurer", plural: "treasurers" },
			{ id: "board", name: "board member", plural: "board members" },
			{ id: "member", name: "member", plural: "members" },
		],
		policy: {
			tiers: [
				{ upTo: euros(200), approvals: [], objectionWindowHours: 0 },
				{ upTo: euros(2_000), approvals: [{ roleId: "board", count: 1 }], objectionWindowHours: 0 },
				{ upTo: null, approvals: [{ roleId: "board", count: 2 }], objectionWindowHours: 48 },
			],
			sealThreshold: euros(10_000),
			newRecipientApprovals: [],
			budgets: [],
		},
	},
	company: {
		id: "company",
		label: "Company",
		roles: [
			{ id: "director", name: "managing director", plural: "managing directors" },
			{ id: "finance", name: "finance", plural: "finance" },
			{ id: "employee", name: "employee", plural: "employees" },
		],
		policy: {
			tiers: [
				{ upTo: euros(1_000), approvals: [], objectionWindowHours: 0 },
				{
					upTo: euros(20_000),
					approvals: [{ roleId: "director", count: 1 }],
					objectionWindowHours: 0,
				},
				{ upTo: null, approvals: [{ roleId: "director", count: 2 }], objectionWindowHours: 0 },
			],
			sealThreshold: euros(50_000),
			newRecipientApprovals: [{ roleId: "director", count: 1 }],
			budgets: [],
		},
	},
	team: {
		id: "team",
		label: "Team",
		roles: [
			{ id: "lead", name: "team lead", plural: "team leads" },
			{ id: "member", name: "member", plural: "members" },
		],
		policy: {
			tiers: [
				{ upTo: euros(100), approvals: [], objectionWindowHours: 0 },
				{ upTo: euros(1_000), approvals: [{ roleId: "lead", count: 1 }], objectionWindowHours: 0 },
				{
					upTo: null,
					approvals: [
						{ roleId: "member", count: 2 },
						{ roleId: "lead", count: 1 },
					],
					objectionWindowHours: 0,
				},
			],
			sealThreshold: euros(5_000),
			newRecipientApprovals: [],
			budgets: [],
		},
	},
};
