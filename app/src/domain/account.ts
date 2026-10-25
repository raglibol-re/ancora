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
	/** Profile picture; initials otherwise. */
	avatarUrl?: string | null;
};

/** "CDPI…HY7C": enough of an address to recognize it. */
export function shortAddress(address: string): string {
	return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

export type Payee = {
	id: string;
	name: string;
	/** IBAN for fiat payouts or a Stellar address; shown, never interpreted here. */
	account: string;
};

/** Structured history; the UI turns entries into words. */
export type ActivityEntry = { id: string; at: number; actorId: PersonId | null } & (
	| { kind: "payment-out"; amount: Cents; payeeId: string; txHash: string | null }
	| { kind: "deposit"; amount: Cents; from: string; txHash: string | null }
	| { kind: "reserve-in" | "reserve-out" | "earnings"; amount: Cents }
	| { kind: "governance"; change: GovernanceChange; viaRequest: boolean }
	| { kind: "logo" }
);

export type AccountNumber = {
	iban: string;
	bic: string;
	holder: string;
};

export type Currency = "EUR" | "USD";

/** The organization's own contract on Stellar. */
export type OnchainAccount = {
	contractId: string;
	/** The founder can still change people and rules directly. */
	setupPhase: boolean;
	/** Hex SHA-256 of the policy document the active rules were compiled from. */
	policyHash: string;
};

/** Everything one organization's account holds: rules, money, requests and history. */
export type OrgAccount = {
	org: Org;
	/** EURC accounts show euros; on testnet the account holds USDC, so it shows dollars. */
	currency: Currency;
	/** Null for sample data. */
	onchain: OnchainAccount | null;
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
 * Moves scheduled requests whose objection window has passed to ready, then executes ready
 * requests: governance changes are applied to the org; payments leave the main balance unless
 * `payments` is "manual" (on-chain accounts, where a signer must sign the transfer first).
 */
export function settleAccount(
	account: OrgAccount,
	now: number,
	payments: "auto" | "manual" = "auto",
): OrgAccount {
	let next: OrgAccount = {
		...account,
		requests: account.requests.map((r) => advanceRequest(r, now)),
	};
	for (const request of next.requests) {
		if (request.status !== "ready") continue;
		if (request.kind === "governance" || payments === "auto") {
			next = execute(next, request, now, null);
		}
	}
	return next;
}

/** Records a payment that was signed and confirmed on-chain. */
export function recordExecutedPayment(
	account: OrgAccount,
	requestId: string,
	txHash: string,
	now: number,
): OrgAccount {
	const request = account.requests.find((r) => r.id === requestId);
	return request ? execute(account, request, now, txHash) : account;
}

function execute(
	account: OrgAccount,
	request: ApprovalRequest,
	now: number,
	txHash: string | null,
): OrgAccount {
	const executed = markExecuted(request);
	if (!executed.ok) return account;
	const done = { ...executed.value, executionRef: txHash };
	const requests = account.requests.map((r) => (r.id === request.id ? done : r));
	const base = { id: `act-${request.id}`, at: now, actorId: request.requesterId };

	if (request.kind === "payment") {
		const entry: ActivityEntry = {
			...base,
			kind: "payment-out",
			amount: request.amount,
			payeeId: request.recipientId,
			txHash,
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
