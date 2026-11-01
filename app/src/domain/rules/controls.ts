import type { Cents } from "../money.ts";
import { bookLimit, currentWindow } from "./limits.ts";
import type { Allowance, Evaluation, Member, Org, PersonId } from "./model.ts";
import { evaluatePayment, limitEvaluation } from "./policy.ts";

// Finer controls on top of the tiers, mirroring the organization contract's controls.rs:
// allowances per asset and budget category, the recipient allowlist, and exchange rates for the
// tiers of payments in another currency. Timestamps here are ms.

/** Rates older than this don't count; foreign-exchange markets close at weekends. */
export const MAX_RATE_AGE_MS = 4 * 24 * 3_600_000;

/** What the allowlist does with a recipient: nothing, strictest tier, or refuse. */
export type RecipientVerdict = "ok" | "escalate" | "refused";

export function recipientVerdict(org: Org, account: string | null): RecipientVerdict {
	const rule = org.recipients;
	if (!rule || rule.mode === "open") return "ok";
	if (account !== null && rule.allowed.includes(account)) return "ok";
	return rule.mode === "approve" ? "escalate" : "refused";
}

/**
 * The amount the tiers and the seal see, in the rules' currency: the amount itself, converted
 * at a fresh rate (rounded up, never under-approved), or null (strictest tier and seal).
 */
export function tierAmount(org: Org, token: string, amount: Cents, now: number): Cents | null {
	const asset = org.assets.find((a) => a.token === token);
	if (!asset || asset.currency === org.baseCurrency) return amount;
	const from = freshPrice(org, asset.currency, now);
	const to = freshPrice(org, org.baseCurrency, now);
	if (from === null || to === null) return null;
	const scaled = BigInt(amount) * from;
	return Number((scaled + to - 1n) / to);
}

/** How many units of the rules' currency one unit of `currency` is worth, for display. */
export function displayRate(org: Org, currency: Org["baseCurrency"], now: number): number | null {
	const from = freshPrice(org, currency, now);
	const to = freshPrice(org, org.baseCurrency, now);
	if (from === null || to === null) return null;
	return Number((from * 1_000_000n) / to) / 1_000_000;
}

function freshPrice(org: Org, currency: Org["baseCurrency"], now: number): bigint | null {
	const quote = org.fx?.prices[currency];
	if (!quote || quote.price <= 0n || now - quote.at > MAX_RATE_AGE_MS) return null;
	return quote.price;
}

export type AllowanceUse =
	| { kind: "allowance"; index: number; counted: Cents }
	| { kind: "limit" }
	| { kind: "none" };

/**
 * Which allowance of `member` a payment uses: the most specific scoped one with room (asset
 * and category, then asset, then category), else the general limit in the rules' currency.
 */
export function pickAllowance(
	member: Member | undefined,
	payment: { token: string; category: string | null; amount: Cents; amountInBase: Cents | null },
	now: number,
): AllowanceUse {
	let best: { index: number; counted: Cents; specificity: number } | null = null;
	for (const [index, allowance] of (member?.allowances ?? []).entries()) {
		if (allowance.token !== null && allowance.token !== payment.token) continue;
		if (allowance.category !== null && allowance.category !== payment.category) continue;
		const counted = allowance.token !== null ? payment.amount : payment.amountInBase;
		if (counted === null) continue;
		const window = currentWindow(allowance, now);
		if (window.spent + counted > allowance.amount) continue;
		const specificity = (allowance.token !== null ? 2 : 0) + (allowance.category !== null ? 1 : 0);
		if (!best || specificity > best.specificity) best = { index, counted, specificity };
	}
	if (best) return { kind: "allowance", index: best.index, counted: best.counted };
	const limit = member?.limit;
	if (limit && payment.amountInBase !== null) {
		const window = currentWindow(limit, now);
		if (window.spent + payment.amountInBase <= limit.amount) return { kind: "limit" };
	}
	return { kind: "none" };
}

/** Books a payment that went out inside a scoped allowance. */
export function bookAllowance(
	org: Org,
	personId: PersonId,
	index: number,
	counted: Cents,
	now: number,
): Org {
	return {
		...org,
		members: org.members.map((m) => {
			if (m.personId !== personId || !m.allowances) return m;
			return {
				...m,
				allowances: m.allowances.map((allowance, i) => {
					if (i !== index) return allowance;
					const window = currentWindow(allowance, now);
					return { ...window, spent: window.spent + counted };
				}),
			};
		}),
	};
}

/** Sets, replaces or (amount 0) removes the allowance with this scope. */
export function withAllowance(
	member: Member,
	scope: { token: string | null; category: string | null },
	amount: Cents,
	periodSeconds: number,
	now: number,
): Member {
	const kept = (member.allowances ?? []).filter(
		(a) => a.token !== scope.token || a.category !== scope.category,
	);
	const added: Allowance[] =
		amount > 0 ? [{ ...scope, amount, periodSeconds, spent: 0, windowStart: now }] : [];
	return { ...member, allowances: [...kept, ...added] };
}

export type ProposalFacts = {
	requesterId: PersonId;
	token: string;
	amount: Cents;
	category: string | null;
	/** Every recipient's address (one for a payment, each line's for a batch). */
	recipients: readonly string[];
	recipientIsNew: boolean;
	overBudget: boolean;
};

export type Proposal =
	| { kind: "refused" }
	| {
			kind: "ok";
			evaluation: Evaluation;
			use: AllowanceUse;
			/** What the tiers saw in the rules' currency; null when no fresh rate was available. */
			amountInTiers: Cents | null;
			outsideAllowlist: boolean;
	  };

/** What the organization contract decides for a payment or batch, before it is proposed. */
export function evaluateProposal(org: Org, facts: ProposalFacts, now: number): Proposal {
	const verdicts = facts.recipients.map((account) => recipientVerdict(org, account));
	if (verdicts.includes("refused")) return { kind: "refused" };
	const outsideAllowlist = verdicts.includes("escalate");
	const asset = org.assets.find((a) => a.token === facts.token);
	const amountInBase = asset?.currency === org.baseCurrency ? facts.amount : null;
	const member = org.members.find((m) => m.personId === facts.requesterId);
	const use: AllowanceUse =
		facts.overBudget || outsideAllowlist
			? { kind: "none" }
			: pickAllowance(member, { ...facts, amountInBase }, now);
	const amountInTiers = tierAmount(org, facts.token, facts.amount, now);
	const evaluation =
		use.kind === "none"
			? evaluatePayment(org.policy, {
					amount: amountInTiers ?? facts.amount,
					recipientIsNew: facts.recipientIsNew,
					foreignCurrency: amountInTiers === null,
					overBudget: facts.overBudget,
					outsideAllowlist,
				})
			: limitEvaluation();
	return { kind: "ok", evaluation, use, amountInTiers, outsideAllowlist };
}

/** Books a payment that went out without approvals against the allowance it used. */
export function bookUse(org: Org, facts: ProposalFacts, now: number): Org {
	const proposal = evaluateProposal(org, facts, now);
	if (proposal.kind !== "ok") return org;
	const { use } = proposal;
	if (use.kind === "allowance") {
		return bookAllowance(org, facts.requesterId, use.index, use.counted, now);
	}
	return use.kind === "limit" ? bookLimit(org, facts.requesterId, facts.amount, now) : org;
}
