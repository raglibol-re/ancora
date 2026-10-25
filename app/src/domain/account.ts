import type { Cents } from "./money.ts";
import { err, ok, type Result } from "./result.ts";
import { isEligibleApprover, memberRank } from "./rules/approvals.ts";
import { applyChange, type GovernanceChange } from "./rules/governance.ts";
import { type Org, type PersonId, type RuleError, ruleError } from "./rules/model.ts";
import { strictestTier } from "./rules/policy.ts";
import {
	type ApprovalRequest,
	advanceRequest,
	markExecuted,
	markFailed,
} from "./rules/requests.ts";

export type Person = {
	id: PersonId;
	name: string;
};

export type Payee = {
	id: string;
	name: string;
	/** IBAN for fiat payouts or a Stellar address; shown, never interpreted here. */
	account: string;
};

/** Structured history; the UI turns entries into words. */
export type ActivityEntry = { id: string; at: number; actorId: PersonId | null } & (
	| { kind: "payment-out"; amount: Cents; payeeId: string }
	| { kind: "deposit"; amount: Cents; from: string }
	| { kind: "reserve-in" | "reserve-out" | "earnings"; amount: Cents }
	| { kind: "governance"; change: GovernanceChange; viaRequest: boolean }
	| { kind: "logo" }
);

export type AccountNumber = {
	iban: string;
	bic: string;
	holder: string;
};

/** Everything one organization's account holds: rules, money, requests and history. */
export type OrgAccount = {
	org: Org;
	balance: Cents;
	reserve: Cents;
	/** Current variable annual rate of the Reserve vault, in basis points. */
	reserveRateBps: number;
	accountNumber: AccountNumber | null;
	logoUrl: string | null;
	payees: readonly Payee[];
	requests: readonly ApprovalRequest[];
	activity: readonly ActivityEntry[];
};

export type Workspace = {
	people: readonly Person[];
	accounts: readonly OrgAccount[];
};

export function accountsOf(workspace: Workspace, personId: PersonId): OrgAccount[] {
	return workspace.accounts.filter((a) => a.org.members.some((m) => m.personId === personId));
}

/** Signed effect of an entry on the main balance. */
export function balanceEffect(entry: ActivityEntry): Cents {
	switch (entry.kind) {
		case "deposit":
		case "reserve-out":
			return entry.amount;
		case "payment-out":
		case "reserve-in":
			return -entry.amount;
		default:
			return 0;
	}
}

/** A recipient is new until a payment to them has actually gone out. */
export function isNewRecipient(account: OrgAccount, payeeId: string): boolean {
	return !account.activity.some((e) => e.kind === "payment-out" && e.payeeId === payeeId);
}

/** Moving money between the main account and the Reserve never leaves the org; approvers may do it. */
export function canManageTreasury(org: Org, personId: PersonId): boolean {
	return (
		memberRank(org, personId) === 0 ||
		isEligibleApprover(org, strictestTier(org.policy).approvals, personId)
	);
}

/** The organization's highest role manages its profile (name, logo). */
export function canEditProfile(org: Org, personId: PersonId): boolean {
	return memberRank(org, personId) === 0;
}

const OPEN_STATUSES: readonly ApprovalRequest["status"][] = ["pending", "scheduled", "ready"];

/** Main-balance money not yet promised to open payment requests. */
export function availableBalance(account: OrgAccount): Cents {
	const committed = account.requests.reduce(
		(sum, r) => (r.kind === "payment" && OPEN_STATUSES.includes(r.status) ? sum + r.amount : sum),
		0,
	);
	return account.balance - committed;
}

export function checkFunds(account: OrgAccount, amount: Cents): Result<Cents, RuleError> {
	if (amount <= availableBalance(account)) return ok(amount);
	return err(
		ruleError(
			"insufficient-funds",
			"There isn't enough money available on the main account. Enter a smaller amount or move money from the Reserve.",
		),
	);
}

export function moveToReserve(account: OrgAccount, amount: Cents): Result<OrgAccount, RuleError> {
	const funds = checkFunds(account, amount);
	if (!funds.ok) return funds;
	return ok({ ...account, balance: account.balance - amount, reserve: account.reserve + amount });
}

export function withdrawFromReserve(
	account: OrgAccount,
	amount: Cents,
): Result<OrgAccount, RuleError> {
	if (amount > account.reserve) {
		return err(
			ruleError(
				"insufficient-funds",
				"The Reserve doesn't hold that much. Enter a smaller amount.",
			),
		);
	}
	return ok({ ...account, balance: account.balance + amount, reserve: account.reserve - amount });
}

/**
 * Moves scheduled requests whose objection window has passed to ready, then executes every ready
 * request: payments leave the main balance, governance changes are applied to the org.
 */
export function settleAccount(account: OrgAccount, now: number): OrgAccount {
	let next: OrgAccount = {
		...account,
		requests: account.requests.map((r) => advanceRequest(r, now)),
	};
	for (const request of next.requests) {
		if (request.status === "ready") next = execute(next, request, now);
	}
	return next;
}

function execute(account: OrgAccount, request: ApprovalRequest, now: number): OrgAccount {
	const executed = markExecuted(request);
	if (!executed.ok) return account;
	const requests = account.requests.map((r) => (r.id === request.id ? executed.value : r));
	const base = { id: `act-${request.id}`, at: now, actorId: request.requesterId };

	if (request.kind === "payment") {
		const entry: ActivityEntry = {
			...base,
			kind: "payment-out",
			amount: request.amount,
			payeeId: request.recipientId,
		};
		return {
			...account,
			requests,
			balance: account.balance - request.amount,
			activity: [entry, ...account.activity],
		};
	}

	// The change was validated when requested; if the org changed since, it may no longer apply.
	const applied = applyChange(account.org, request.change);
	if (!applied.ok) {
		const failed = markFailed(request, applied.error);
		return {
			...account,
			requests: account.requests.map((r) => (r.id === request.id ? failed : r)),
		};
	}
	const entry: ActivityEntry = {
		...base,
		kind: "governance",
		change: request.change,
		viaRequest: true,
	};
	return { ...account, org: applied.value, requests, activity: [entry, ...account.activity] };
}

/** Rough daily earnings at the current variable rate; real figures come from the vault (task 7). */
export function estimatedDailyEarnings(account: OrgAccount): Cents {
	return Math.round((account.reserve * account.reserveRateBps) / 10_000 / 365);
}
