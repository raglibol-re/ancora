import type { Cents } from "./money.ts";

// Deals between two parties (contracts/deal): A pays, B delivers. A creates the deal, B accepts
// the terms, A deposits the total, B asks for each milestone's payout, which goes out when A
// approves or automatically once the objection period passes. An optional arbiter splits what
// is left in a dispute. Timestamps here are ms.

export type DealStatus =
	| "draft"
	| "accepted"
	| "funded"
	| "active"
	| "completed"
	| "cancelled"
	| "disputed"
	| "resolved";

export type MilestoneStatus = "open" | "requested" | "objected" | "released";

export type Milestone = {
	label: string;
	amount: Cents;
	status: MilestoneStatus;
	/** When B last asked for the payout; null before. */
	requestedAt: number | null;
};

export type Deal = {
	id: number;
	partyA: string;
	partyB: string;
	/** Token the deal pays in. */
	token: string;
	milestones: readonly Milestone[];
	objectionSeconds: number;
	arbiter: string | null;
	/** Hex SHA-256 of the contract documents (kept off-chain). */
	documentHash: string;
	status: DealStatus;
	total: Cents;
	paidOut: Cents;
	createdAt: number;
	/** Parties who asked to cancel a funded deal; both must ask. */
	cancelAsks: readonly string[];
};

export type DealTermsInput = {
	token: string;
	milestones: readonly { label: string; amount: Cents }[];
	objectionSeconds: number;
	arbiter: string | null;
	documentHash: string;
};

/** What one party does in a deal (mirrors the organization contract's `DealAction`). */
export type DealAction =
	| { type: "create"; partyB: string; terms: DealTermsInput }
	| { type: "accept"; dealId: number }
	| { type: "fund"; dealId: number }
	| { type: "requestRelease"; dealId: number; milestone: number }
	| { type: "approveRelease"; dealId: number; milestone: number }
	| { type: "object"; dealId: number; milestone: number }
	| { type: "cancel"; dealId: number }
	| { type: "dispute"; dealId: number };

export type DealSide = "a" | "b";

export const MIN_OBJECTION_SECONDS = 60;
export const MAX_OBJECTION_SECONDS = 90 * 86_400;
export const MAX_MILESTONES = 20;

export function sideOf(deal: Deal, partyId: string): DealSide | null {
	if (deal.partyA === partyId) return "a";
	if (deal.partyB === partyId) return "b";
	return null;
}

/** When a requested milestone pays out automatically. */
export function payoutAt(deal: Deal, milestone: Milestone): number | null {
	return milestone.requestedAt === null
		? null
		: milestone.requestedAt + deal.objectionSeconds * 1000;
}

/** A step the viewer can take; `releaseNow` needs no approval (the payout is already due). */
export type DealStep = {
	action: DealAction | { type: "releaseNow"; dealId: number; milestone: number };
};

/** The steps open to `side` right now, in the order the UI offers them. */
export function stepsFor(deal: Deal, side: DealSide | null, now: number): DealStep[] {
	const steps: DealStep[] = [];
	const dealId = deal.id;
	const running = deal.status === "funded" || deal.status === "active";
	if (side === "b" && deal.status === "draft") steps.push({ action: { type: "accept", dealId } });
	if (side === "a" && deal.status === "accepted") steps.push({ action: { type: "fund", dealId } });
	deal.milestones.forEach((m, milestone) => {
		const due = payoutAt(deal, m);
		const inPeriod = due !== null && now < due;
		if (side === "b" && running && (m.status === "open" || m.status === "objected")) {
			steps.push({ action: { type: "requestRelease", dealId, milestone } });
		}
		if (side === "a" && deal.status === "active") {
			if (m.status === "requested" || m.status === "objected") {
				steps.push({ action: { type: "approveRelease", dealId, milestone } });
			}
			if (m.status === "requested" && inPeriod) {
				steps.push({ action: { type: "object", dealId, milestone } });
			}
		}
		if (deal.status === "active" && m.status === "requested" && due !== null && !inPeriod) {
			steps.push({ action: { type: "releaseNow", dealId, milestone } });
		}
	});
	const mayCancel =
		(side === "a" && (deal.status === "draft" || deal.status === "accepted")) ||
		(side !== null &&
			running &&
			!deal.cancelAsks.includes(side === "a" ? deal.partyA : deal.partyB));
	if (mayCancel) steps.push({ action: { type: "cancel", dealId } });
	if (side !== null && running && deal.arbiter !== null) {
		steps.push({ action: { type: "dispute", dealId } });
	}
	return steps;
}

/** Plain-language name of a deal step, as a request title or a button. */
export function describeDealAction(
	action: DealStep["action"],
	milestoneLabel: (dealId: number, milestone: number) => string,
): string {
	switch (action.type) {
		case "create":
			return `Propose a deal of ${action.terms.milestones.length} milestone${action.terms.milestones.length === 1 ? "" : "s"}`;
		case "accept":
			return `Accept the terms of deal #${action.dealId}`;
		case "fund":
			return `Deposit the amount for deal #${action.dealId}`;
		case "requestRelease":
			return `Ask for the payout of "${milestoneLabel(action.dealId, action.milestone)}"`;
		case "approveRelease":
			return `Approve the payout of "${milestoneLabel(action.dealId, action.milestone)}"`;
		case "object":
			return `Object to the payout of "${milestoneLabel(action.dealId, action.milestone)}"`;
		case "cancel":
			return `Cancel deal #${action.dealId}`;
		case "dispute":
			return `Ask the arbiter to decide deal #${action.dealId}`;
		case "releaseNow":
			return `Pay out "${milestoneLabel(action.dealId, action.milestone)}" now`;
	}
}

export const DEAL_STATUS_LABELS: Readonly<Record<DealStatus, string>> = {
	draft: "Waiting for the other side to accept",
	accepted: "Waiting for the deposit",
	funded: "Amount deposited",
	active: "In progress",
	completed: "Completed",
	cancelled: "Cancelled",
	disputed: "With the arbiter",
	resolved: "Decided by the arbiter",
};

export const MILESTONE_STATUS_LABELS: Readonly<Record<MilestoneStatus, string>> = {
	open: "Not started",
	requested: "Payout requested",
	objected: "Objected",
	released: "Paid out",
};

/** Messages for the deal contract's errors, recorded on a failed request as 1000 + code. */
export const DEAL_ERROR_MESSAGES: Readonly<Record<number, string>> = {
	1: "This deal doesn't exist.",
	2: "The deal has moved on, so this step no longer applies. Reload to see where it stands.",
	3: "Only the parties of the deal can do this.",
	4: "The terms aren't valid: two different parties, one to twenty milestones above zero, an objection period from one minute to 90 days, and an arbiter who isn't a party.",
	5: "This milestone doesn't exist.",
	6: "This milestone isn't in a state that allows this step.",
	7: "The objection period is still running.",
	8: "The objection period is over.",
	9: "This deal has no arbiter.",
	10: "The arbiter has to split exactly what is left between the two parties.",
	11: "You already asked to cancel; the other side has to agree.",
	12: "A milestone name is too long (64 characters at most).",
};
