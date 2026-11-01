import { xdr } from "@stellar/stellar-sdk";
import type { Deal, DealAction, DealStatus, MilestoneStatus } from "../../domain/deals.ts";
import { address, i128, struct, text, toCents, toStroops, u32, u64 } from "./scv.ts";

// Deals between the organization contract (`DealAction`, `DealCall`) and the deal contract
// (`Deal`) in their XDR form, and back.

type Native = Record<string, unknown>;

const variant = (value: unknown): [string, unknown[]] => {
	if (Array.isArray(value) && typeof value[0] === "string") return [value[0], value.slice(1)];
	throw new Error(`Expected an enum value, got ${JSON.stringify(value)}`);
};
const tagged = (name: string, ...fields: xdr.ScVal[]) =>
	xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name), ...fields]);
const optionalAddress = (value: string | null) => (value ? address(value) : xdr.ScVal.scvVoid());

function actionToScVal(action: DealAction): xdr.ScVal {
	switch (action.type) {
		case "create":
			return tagged(
				"Create",
				address(action.partyB),
				struct({
					arbiter: optionalAddress(action.terms.arbiter),
					asset: address(action.terms.token),
					document_hash: xdr.ScVal.scvBytes(Buffer.from(action.terms.documentHash, "hex")),
					milestones: xdr.ScVal.scvVec(
						action.terms.milestones.map((m) =>
							struct({ amount: i128(toStroops(m.amount)), label: text(m.label) }),
						),
					),
					objection_seconds: u64(action.terms.objectionSeconds),
				}),
			);
		case "accept":
			return tagged("Accept", u64(action.dealId));
		case "fund":
			return tagged("Fund", u64(action.dealId));
		case "requestRelease":
			return tagged("RequestRelease", u64(action.dealId), u32(action.milestone));
		case "approveRelease":
			return tagged("ApproveRelease", u64(action.dealId), u32(action.milestone));
		case "object":
			return tagged("Object", u64(action.dealId), u32(action.milestone));
		case "cancel":
			return tagged("Cancel", u64(action.dealId));
		case "dispute":
			return tagged("Dispute", u64(action.dealId));
	}
}

/** The organization contract's `DealCall`; what it holds back is set by the contract itself. */
export function dealCallToScVal(contract: string, action: DealAction): xdr.ScVal {
	return struct({
		action: actionToScVal(action),
		deals: address(contract),
		reserved_amount: i128(0n),
		reserved_token: xdr.ScVal.scvVoid(),
	});
}

export function mapDealAction(value: unknown): DealAction {
	const [kind, fields] = variant(value);
	const dealId = Number(fields[0]);
	const milestone = Number(fields[1]);
	switch (kind) {
		case "Create": {
			const terms = fields[1] as Native;
			return {
				type: "create",
				partyB: String(fields[0]),
				terms: {
					token: String(terms.asset),
					milestones: (terms.milestones as Native[]).map((m) => ({
						label: String(m.label),
						amount: toCents(BigInt(m.amount as bigint)),
					})),
					objectionSeconds: Number(terms.objection_seconds),
					arbiter: terms.arbiter ? String(terms.arbiter) : null,
					documentHash: Buffer.from(terms.document_hash as Uint8Array).toString("hex"),
				},
			};
		}
		case "Accept":
			return { type: "accept", dealId };
		case "Fund":
			return { type: "fund", dealId };
		case "RequestRelease":
			return { type: "requestRelease", dealId, milestone };
		case "ApproveRelease":
			return { type: "approveRelease", dealId, milestone };
		case "Object":
			return { type: "object", dealId, milestone };
		case "Cancel":
			return { type: "cancel", dealId };
		case "Dispute":
			return { type: "dispute", dealId };
		default:
			throw new Error(`Unknown deal action ${kind}`);
	}
}

const STATUSES: Record<string, DealStatus> = {
	Draft: "draft",
	Accepted: "accepted",
	Funded: "funded",
	Active: "active",
	Completed: "completed",
	Cancelled: "cancelled",
	Disputed: "disputed",
	Resolved: "resolved",
};

const MILESTONE_STATUSES: Record<string, MilestoneStatus> = {
	Open: "open",
	Requested: "requested",
	Objected: "objected",
	Released: "released",
};

/** A deal as the deal contract's `deal` / `deals_of` views return it. */
export function mapDeal(native: Native): Deal {
	const seconds = (value: unknown) => Number(value) * 1000;
	return {
		id: Number(native.id),
		partyA: String(native.party_a),
		partyB: String(native.party_b),
		token: String(native.asset),
		milestones: (native.milestones as Native[]).map((m) => ({
			label: String(m.label),
			amount: toCents(BigInt(m.amount as bigint)),
			status: MILESTONE_STATUSES[variant(m.status)[0]] ?? "open",
			requestedAt: Number(m.requested_at) > 0 ? seconds(m.requested_at) : null,
		})),
		objectionSeconds: Number(native.objection_seconds),
		arbiter: native.arbiter ? String(native.arbiter) : null,
		documentHash: Buffer.from(native.document_hash as Uint8Array).toString("hex"),
		status: STATUSES[variant(native.status)[0]] ?? "draft",
		total: toCents(BigInt(native.total as bigint)),
		paidOut: toCents(BigInt(native.paid_out as bigint)),
		createdAt: seconds(native.created_at),
		cancelAsks: (native.cancel_asks as unknown[]).map(String),
	};
}
