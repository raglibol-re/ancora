import type { Cents } from "../money.ts";

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

export type Member = {
	personId: PersonId;
	roleId: RoleId;
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
};

/** What a specific request needs before it can execute. */
export type Evaluation = {
	/** Index into policy.tiers; null for governance requests, which always use the strictest tier. */
	tierIndex: number | null;
	approvals: readonly Requirement[];
	objectionWindowHours: number;
	sealRequired: boolean;
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
	| "not-found";

export type RuleError = {
	code: RuleErrorCode;
	/** Plain-language message for the user: what happened and how to fix it. */
	message: string;
};

export const ruleError = (code: RuleErrorCode, message: string): RuleError => ({ code, message });
