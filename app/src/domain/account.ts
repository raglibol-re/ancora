import type { Cents, Currency } from "./money.ts";
import { err, ok, type Result } from "./result.ts";
import { isEligibleApprover, memberRank } from "./rules/approvals.ts";
import { applyChange, type GovernanceChange } from "./rules/governance.ts";
import { type Asset, type Org, type PersonId, type RuleError, ruleError } from "./rules/model.ts";
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

/** Structured history; the UI turns entries into words. Money entries name their asset. */
export type ActivityEntry = { id: string; at: number; actorId: PersonId | null } & (
	| { kind: "payment-out"; token: string; amount: Cents; payeeId: string; txHash: string | null }
	| { kind: "deposit"; token: string; amount: Cents; from: string; txHash: string | null }
	| { kind: "reserve-in" | "reserve-out" | "earnings"; token: string; amount: Cents }
	| { kind: "governance"; change: GovernanceChange; viaRequest: boolean }
	| { kind: "logo" }
);

export type AccountNumber = {
	iban: string;
	bic: string;
	holder: string;
};

/** The organization's own contract on Stellar. */
export type OnchainAccount = {
	contractId: string;
	/** The founder can still change people and rules directly. */
	setupPhase: boolean;
	/** Hex SHA-256 of the policy document the active rules were compiled from. */
	policyHash: string;
};

/** What the organization holds of one accepted asset: on the main account and in the Reserve. */
export type Balance = {
	token: string;
	balance: Cents;
	reserve: Cents;
};

/** Everything one organization's account holds: rules, money, requests and history. */
export type OrgAccount = {
	org: Org;
	/** Null for sample data. */
	onchain: OnchainAccount | null;
	/** One entry per accepted asset (see `org.assets`). */
	balances: readonly Balance[];
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

export function assetOf(org: Org, token: string): Asset | undefined {
	return org.assets.find((a) => a.token === token);
}

/** The currency an amount in `token` is shown in; the rules' currency for unknown tokens. */
export function currencyOf(account: OrgAccount, token: string): Currency {
	return assetOf(account.org, token)?.currency ?? account.org.baseCurrency;
}

/** Whether payments in `token` take the strictest tier (another currency than the rules). */
export function isForeign(org: Org, token: string): boolean {
	return (assetOf(org, token)?.currency ?? org.baseCurrency) !== org.baseCurrency;
}

export function balanceOf(account: OrgAccount, token: string): Balance {
	return account.balances.find((b) => b.token === token) ?? { token, balance: 0, reserve: 0 };
}

/** The asset the Send page and the overview lead with: the first one in the rules' currency. */
export function primaryToken(account: OrgAccount): string {
	const home = account.org.assets.find((a) => a.currency === account.org.baseCurrency);
	return home?.token ?? account.org.assets[0]?.token ?? "";
}

/** Signed effect of an entry on its asset's main balance. */
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

/** Main-balance money in `token` not yet promised to open payment requests. */
export function availableBalance(account: OrgAccount, token: string): Cents {
	const committed = account.requests.reduce(
		(sum, r) =>
			r.kind === "payment" && r.token === token && OPEN_STATUSES.includes(r.status)
				? sum + r.amount
				: sum,
		0,
	);
	return balanceOf(account, token).balance - committed;
}

/** Whether an asset can be dropped: nothing left on it and no open request pays from it. */
export function assetInUse(account: OrgAccount, token: string): boolean {
	const { balance, reserve } = balanceOf(account, token);
	return (
		balance !== 0 ||
		reserve !== 0 ||
		account.requests.some(
			(r) => r.kind === "payment" && r.token === token && OPEN_STATUSES.includes(r.status),
		)
	);
}

export function checkFunds(
	account: OrgAccount,
	token: string,
	amount: Cents,
): Result<Cents, RuleError> {
	if (!assetOf(account.org, token)) {
		return err(ruleError("unknown-asset", "This organization doesn't hold that asset."));
	}
	if (amount <= availableBalance(account, token)) return ok(amount);
	return err(
		ruleError(
			"insufficient-funds",
			"There isn't enough money available on the main account. Enter a smaller amount or move money from the Reserve.",
		),
	);
}

function withBalance(account: OrgAccount, token: string, change: Partial<Balance>): OrgAccount {
	const current = balanceOf(account, token);
	const next = { ...current, ...change };
	const others = account.balances.filter((b) => b.token !== token);
	return { ...account, balances: [...others, next] };
}

export function moveToReserve(
	account: OrgAccount,
	token: string,
	amount: Cents,
): Result<OrgAccount, RuleError> {
	const funds = checkFunds(account, token, amount);
	if (!funds.ok) return funds;
	const { balance, reserve } = balanceOf(account, token);
	return ok(withBalance(account, token, { balance: balance - amount, reserve: reserve + amount }));
}

export function withdrawFromReserve(
	account: OrgAccount,
	token: string,
	amount: Cents,
): Result<OrgAccount, RuleError> {
	const { balance, reserve } = balanceOf(account, token);
	if (amount > reserve) {
		return err(
			ruleError(
				"insufficient-funds",
				"The Reserve doesn't hold that much. Enter a smaller amount.",
			),
		);
	}
	return ok(withBalance(account, token, { balance: balance + amount, reserve: reserve - amount }));
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
			token: request.token,
			amount: request.amount,
			payeeId: request.recipientId,
			txHash,
		};
		const { balance } = balanceOf(account, request.token);
		return {
			...withBalance(account, request.token, { balance: balance - request.amount }),
			requests,
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
	return {
		...syncBalances({ ...account, org: applied.value }),
		requests,
		activity: [entry, ...account.activity],
	};
}

/** Keeps one balance entry per accepted asset after assets were added or removed. */
export function syncBalances(account: OrgAccount): OrgAccount {
	return {
		...account,
		balances: account.org.assets.map((asset) => balanceOf(account, asset.token)),
	};
}

/** Rough daily earnings at the current variable rate; real figures come from the vault (task 7). */
export function estimatedDailyEarnings(account: OrgAccount, token: string): Cents {
	return Math.round((balanceOf(account, token).reserve * account.reserveRateBps) / 10_000 / 365);
}
