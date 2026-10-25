import type { Cents, Currency } from "../money.ts";

export type RoleId = string;
export type PersonId = string;
export type TemplateId = "club" | "company" | "team";

export type Role = {
	id: RoleId;
	name: string;
	plural: string;
};

/** "count people holding roleId (or a higher-ranked role) must approve". */
export type Requirement = {
	roleId: RoleId;
	count: number;
};

export type Tier = {
	/** Inclusive upper bound; null for the last, unbounded tier. */
	upTo: Cents | null;
	approvals: readonly Requirement[];
	/** Hours between full approval and execution during which an approver can still object. */
	objectionWindowHours: number;
};

export type Policy = {
	/** Ascending by upTo; the last tier is unbounded. The last tier is also the strictest. */
	tiers: readonly Tier[];
	/** Payments at or above this amount additionally need the security seal. */
	sealThreshold: Cents;
	/** Extra requirements for the first payment to a recipient, merged per role (higher count wins). */
	newRecipientApprovals: readonly Requirement[];
};

/** A crew or agent allowance: up to `amount` per rolling period goes out without approvals. */
export type SpendingLimit = {
	amount: Cents;
	periodSeconds: number;
	spent: Cents;
	/** Start of the running window, ms; 0 until the first payment. */
	windowStart: number;
};

export type Member = {
	personId: PersonId;
	roleId: RoleId;
	limit?: SpendingLimit;
};

/** A stablecoin the organization accepts and the fiat currency it stands for. */
export type Asset = {
	/** Token contract address on Stellar; a label in sample data. */
	token: string;
	symbol: string;
	currency: Currency;
	/** The vault the asset's Reserve earns in (DeFindex on testnet); none means no Reserve. */
	vault?: string | null;
};

export type Org = {
	id: string;
	name: string;
	templateId: TemplateId;
	/** Ordered by rank: index 0 is the highest role. */
	roles: readonly Role[];
	members: readonly Member[];
	policy: Policy;
	founderId: PersonId;
	/** The currency the rules are written in; payments in other currencies take the strictest tier. */
	baseCurrency: Currency;
	assets: readonly Asset[];
};

/** What a specific request needs before it can execute. */
export type Evaluation = {
	/** Index into policy.tiers; null for governance requests, which always use the strictest tier. */
	tierIndex: number | null;
	approvals: readonly Requirement[];
	objectionWindowHours: number;
	sealRequired: boolean;
	/** The payment fit the requester's spending limit, so nothing needs approval. */
	withinLimit?: boolean;
};

export type RuleErrorCode =
	| "invalid-amount"
	| "invalid-policy"
	| "unknown-role"
	| "not-a-member"
	| "already-a-member"
	| "requester-cannot-approve"
	| "already-approved"
	| "role-cannot-approve"
	| "approval-not-needed"
	| "not-pending"
	| "seal-not-required"
	| "already-sealed"
	| "cannot-decline"
	| "not-ready"
	| "not-in-setup-phase"
	| "would-lock-account"
	| "insufficient-funds"
	| "not-allowed"
	| "not-found"
	| "unknown-asset"
	| "asset-exists"
	| "asset-in-use"
	| "last-asset"
	| "invalid-limit";

export type RuleError = {
	code: RuleErrorCode;
	/** Plain-language message for the user: what happened and how to fix it. */
	message: string;
};

export const ruleError = (code: RuleErrorCode, message: string): RuleError => ({ code, message });
