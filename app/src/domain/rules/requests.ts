import { type Cents, type Currency, isValidAmount } from "../money.ts";
import { err, ok, type Result } from "../result.ts";
import {
	approvalProgress,
	approvalWouldCount,
	isEligibleApprover,
	memberRank,
} from "./approvals.ts";
import { applyChange, type GovernanceChange } from "./governance.ts";
import { fitsLimit } from "./limits.ts";
import { type Evaluation, type Org, type PersonId, type RuleError, ruleError } from "./model.ts";
import { evaluateGovernance, evaluatePayment, limitEvaluation } from "./policy.ts";

/**
 * pending   → waiting for approvals (and the seal, if required)
 * scheduled → fully approved, objection window running until executeAfter
 * ready     → may execute now
 * executed  → done on-chain
 * declined  → rejected by an approver, objected to during the window, or cancelled by the requester
 * failed    → approved, but execution failed (e.g. a network error or a change that no longer applies)
 */
export type RequestStatus =
	| "pending"
	| "scheduled"
	| "ready"
	| "executed"
	| "declined"
	| "failed"
	/** Approved and funded, held until the recipient and the sender's side both confirm. */
	| "escrowed";

/** Who has confirmed a secure handover so far. */
export type EscrowConfirmations = { recipient: boolean; sender: boolean };

type Timestamp = number;

type RequestBase = {
	id: string;
	requesterId: PersonId;
	createdAt: Timestamp;
	/** Snapshot of the rules at creation; later rule changes don't affect requests in flight. */
	evaluation: Evaluation;
	approvals: readonly { personId: PersonId; at: Timestamp }[];
	sealedBy: PersonId | null;
	status: RequestStatus;
	executeAfter: Timestamp | null;
	declinedBy: PersonId | null;
	failure: RuleError | null;
	/** Transaction hash once executed on-chain; null for sample data and governance changes. */
	executionRef: string | null;
};

export type PaymentRequest = RequestBase & {
	kind: "payment";
	/** The asset the payment goes out in, and its currency (fixed when requested). */
	token: string;
	currency: Currency;
	amount: Cents;
	recipientId: string;
	recipientIsNew: boolean;
	/** Reference shown to approvers and on the statement. */
	note: string;
	/** The budget category it counts against, if any. */
	category: string | null;
	/** Secure handover: held after approval until both sides confirm. */
	escrow: boolean;
	escrowConfirmed: EscrowConfirmations | null;
};

export type GovernanceRequest = RequestBase & {
	kind: "governance";
	change: GovernanceChange;
};

export type ApprovalRequest = PaymentRequest | GovernanceRequest;

const HOUR_MS = 3_600_000;

const blank = (id: string, requesterId: PersonId, now: Timestamp, evaluation: Evaluation) => ({
	id,
	requesterId,
	createdAt: now,
	evaluation,
	approvals: [],
	sealedBy: null,
	status: "pending" as const,
	executeAfter: null,
	declinedBy: null,
	failure: null,
	executionRef: null,
});

const notMember = () =>
	err(ruleError("not-a-member", "You're not part of this organization, so you can't do this."));

export type NewPayment = {
	id: string;
	category?: string | null;
	escrow?: boolean;
	/** The data source checked the budget: beyond a soft one, the strictest tier applies. */
	overBudget?: boolean;
	requesterId: PersonId;
	token: string;
	amount: Cents;
	recipientId: string;
	recipientIsNew: boolean;
	note: string;
};

export function createPaymentRequest(
	org: Org,
	input: NewPayment,
	now: Timestamp,
): Result<PaymentRequest, RuleError> {
	if (memberRank(org, input.requesterId) === undefined) return notMember();
	if (!isValidAmount(input.amount)) {
		return err(ruleError("invalid-amount", "Enter an amount above zero."));
	}
	const asset = org.assets.find((a) => a.token === input.token);
	if (!asset) {
		return err(ruleError("unknown-asset", "This organization doesn't hold that asset."));
	}
	const foreignCurrency = asset.currency !== org.baseCurrency;
	const requester = org.members.find((m) => m.personId === input.requesterId);
	const { overBudget = false, ...fields } = input;
	const evaluation =
		!foreignCurrency && !overBudget && fitsLimit(requester, input.amount, now)
			? limitEvaluation()
			: evaluatePayment(org.policy, {
					amount: input.amount,
					recipientIsNew: input.recipientIsNew,
					foreignCurrency,
					overBudget,
				});
	return ok(
		settle(
			org,
			{
				...blank(input.id, input.requesterId, now, evaluation),
				kind: "payment",
				...fields,
				category: fields.category ?? null,
				escrow: fields.escrow ?? false,
				escrowConfirmed: null,
				currency: asset.currency,
			},
			now,
		),
	);
}

export function createGovernanceRequest(
	org: Org,
	input: { id: string; requesterId: PersonId; change: GovernanceChange },
	now: Timestamp,
): Result<GovernanceRequest, RuleError> {
	if (memberRank(org, input.requesterId) === undefined) return notMember();
	const preview = applyChange(org, input.change);
	if (!preview.ok) return preview;
	const base = blank(input.id, input.requesterId, now, evaluateGovernance(org.policy));
	return ok(settle(org, { ...base, kind: "governance", change: input.change }, now));
}

export function approveRequest<R extends ApprovalRequest>(
	org: Org,
	request: R,
	personId: PersonId,
	now: Timestamp,
): Result<R, RuleError> {
	const { approvals } = request.evaluation;
	const approverIds = request.approvals.map((a) => a.personId);
	if (request.status !== "pending") return notPending();
	if (memberRank(org, personId) === undefined) return notMember();
	if (personId === request.requesterId) {
		return err(
			ruleError(
				"requester-cannot-approve",
				"You created this request, so someone else has to approve it.",
			),
		);
	}
	if (approverIds.includes(personId)) {
		return err(ruleError("already-approved", "You've already approved this request."));
	}
	if (!isEligibleApprover(org, approvals, personId)) {
		return err(ruleError("role-cannot-approve", "Your role can't approve this request."));
	}
	if (!approvalWouldCount(org, approvals, approverIds, request.requesterId, personId)) {
		return err(
			ruleError(
				"approval-not-needed",
				"Your approval isn't needed: the remaining approvals must come from a higher role.",
			),
		);
	}
	return ok(
		settle(org, { ...request, approvals: [...request.approvals, { personId, at: now }] }, now),
	);
}

/** Adds the security seal (ML-DSA signature) from someone other than the requester. */
export function sealRequest<R extends ApprovalRequest>(
	org: Org,
	request: R,
	personId: PersonId,
	now: Timestamp,
): Result<R, RuleError> {
	if (request.status !== "pending") return notPending();
	if (!request.evaluation.sealRequired) {
		return err(ruleError("seal-not-required", "This request doesn't need the security seal."));
	}
	if (request.sealedBy !== null) {
		return err(ruleError("already-sealed", "This request already has the security seal."));
	}
	if (personId === request.requesterId) {
		return err(
			ruleError(
				"requester-cannot-approve",
				"You created this request, so someone else has to seal it.",
			),
		);
	}
	if (!isEligibleApprover(org, request.evaluation.approvals, personId)) {
		return err(ruleError("role-cannot-approve", "Your role can't seal this request."));
	}
	return ok(settle(org, { ...request, sealedBy: personId }, now));
}

/** Decline while pending, or object during the objection window. The requester may cancel. */
export function declineRequest<R extends ApprovalRequest>(
	org: Org,
	request: R,
	personId: PersonId,
): Result<R, RuleError> {
	if (request.status !== "pending" && request.status !== "scheduled") {
		return err(
			ruleError("cannot-decline", "This request is already decided and can't be declined."),
		);
	}
	const mayDecline =
		personId === request.requesterId ||
		isEligibleApprover(org, request.evaluation.approvals, personId);
	if (!mayDecline) {
		return err(ruleError("cannot-decline", "Your role can't decline this request."));
	}
	return ok({ ...request, status: "declined", declinedBy: personId });
}

/** Moves a scheduled request to ready once its objection window has passed. */
export function advanceRequest<R extends ApprovalRequest>(request: R, now: Timestamp): R {
	if (
		request.status === "scheduled" &&
		request.executeAfter !== null &&
		now >= request.executeAfter
	) {
		return { ...request, status: "ready" };
	}
	return request;
}

/** Records that the request was executed on-chain; a secure handover is held instead. */
export function markExecuted<R extends ApprovalRequest>(request: R): Result<R, RuleError> {
	if (request.status !== "ready") {
		return err(ruleError("not-ready", "This request can't be executed yet."));
	}
	if (request.kind === "payment" && request.escrow) {
		return ok({
			...request,
			status: "escrowed",
			escrowConfirmed: { recipient: false, sender: false },
		});
	}
	return ok({ ...request, status: "executed" });
}

const notEscrowed = () =>
	err(ruleError("not-escrowed", "This payment isn't a held handover waiting for confirmations."));

/** The requester, or anyone whose role could have approved the request. */
export function isSenderSide(org: Org, request: ApprovalRequest, personId: PersonId): boolean {
	return (
		personId === request.requesterId ||
		isEligibleApprover(org, request.evaluation.approvals, personId)
	);
}

/**
 * One side of a secure handover confirms: the recipient (by id) or the sender's side. Once both
 * have, the payment is executed; the caller moves the money.
 */
export function confirmEscrow(
	org: Org,
	request: ApprovalRequest,
	personId: PersonId,
): Result<PaymentRequest, RuleError> {
	if (request.kind !== "payment" || request.status !== "escrowed") return notEscrowed();
	const confirmed = request.escrowConfirmed ?? { recipient: false, sender: false };
	let next: EscrowConfirmations;
	if (personId === request.recipientId) next = { ...confirmed, recipient: true };
	else if (isSenderSide(org, request, personId)) next = { ...confirmed, sender: true };
	else {
		return err(
			ruleError(
				"not-escrow-party",
				"Only the recipient, the requester or an eligible approver can confirm this handover.",
			),
		);
	}
	return ok({
		...request,
		escrowConfirmed: next,
		status: next.recipient && next.sender ? "executed" : "escrowed",
	});
}

/** The sender's side frees the money again; the recipient can only decline by not confirming. */
export function cancelEscrow(
	org: Org,
	request: ApprovalRequest,
	personId: PersonId,
): Result<PaymentRequest, RuleError> {
	if (request.kind !== "payment" || request.status !== "escrowed") return notEscrowed();
	if (!isSenderSide(org, request, personId)) {
		return err(
			ruleError(
				"not-escrow-party",
				"Only the requester or an eligible approver can cancel this handover.",
			),
		);
	}
	return ok({ ...request, status: "declined", declinedBy: personId });
}

/** Records a failed execution; the demo admin can retry it later. */
export function markFailed<R extends ApprovalRequest>(request: R, failure: RuleError): R {
	return { ...request, status: "failed", failure };
}

export function isFullyApproved(org: Org, request: ApprovalRequest): boolean {
	const progress = approvalProgress(
		org,
		request.evaluation.approvals,
		request.approvals.map((a) => a.personId),
		request.requesterId,
	);
	return progress.satisfied && (!request.evaluation.sealRequired || request.sealedBy !== null);
}

function settle<R extends ApprovalRequest>(org: Org, request: R, now: Timestamp): R {
	if (request.status !== "pending" || !isFullyApproved(org, request)) return request;
	const windowHours = request.evaluation.objectionWindowHours;
	return windowHours > 0
		? { ...request, status: "scheduled", executeAfter: now + windowHours * HOUR_MS }
		: { ...request, status: "ready" };
}

const notPending = () =>
	err(ruleError("not-pending", "This request is no longer waiting for approvals."));
