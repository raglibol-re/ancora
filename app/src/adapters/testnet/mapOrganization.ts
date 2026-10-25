import {
	type ActivityEntry,
	type OrgAccount,
	type Payee,
	shortAddress,
} from "../../domain/account.ts";
import type { Currency } from "../../domain/money.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import {
	type Asset,
	type Evaluation,
	type Org,
	type Policy,
	type Requirement,
	type Role,
	type RuleErrorCode,
	ruleError,
	type SpendingLimit,
	type TemplateId,
} from "../../domain/rules/model.ts";
import type { ApprovalRequest, RequestStatus } from "../../domain/rules/requests.ts";
import { templates } from "../../domain/rules/templates.ts";
import { toCents } from "./scv.ts";

// Pure mapping from the organization contract's decoded values (scValToNative output) to the
// app's domain types. Enum values arrive as ["Variant", ...fields]; numbers as number/bigint.

type Native = Record<string, unknown>;

export type OnchainSnapshot = {
	contractId: string;
	info: Native;
	policy: Native;
	assets: Native[];
	members: Native[];
	requests: Native[];
	/** Token balance per accepted token address. */
	balances: ReadonlyMap<string, bigint>;
	/** Reserve value and principal per token that has a vault. */
	reserves: ReadonlyMap<string, { value: bigint; principal: bigint }>;
	/** Spending limits by member address. */
	limits: ReadonlyMap<string, SpendingLimit>;
	setupPhase: boolean;
	policyHash: string;
};

const STATUS: Record<string, RequestStatus> = {
	Pending: "pending",
	Scheduled: "scheduled",
	Ready: "ready",
	Executed: "executed",
	Declined: "declined",
	Failed: "failed",
};

/** Contract error codes, in the order of the contract's `Error` enum. */
const ERROR_CODES: RuleErrorCode[] = [
	"not-a-member",
	"invalid-amount",
	"invalid-policy",
	"unknown-role",
	"already-a-member",
	"requester-cannot-approve",
	"already-approved",
	"role-cannot-approve",
	"approval-not-needed",
	"not-pending",
	"seal-not-required",
	"already-sealed",
	"cannot-decline",
	"not-ready",
	"not-in-setup-phase",
	"would-lock-account",
	"insufficient-funds",
	"not-found",
	"not-allowed",
	"invalid-policy",
	"invalid-amount",
	"unknown-asset",
	"asset-exists",
	"asset-in-use",
	"last-asset",
	"not-allowed",
	"not-allowed",
	"not-allowed",
	"invalid-limit",
];

export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
	1: "You're not part of this organization.",
	2: "Enter an amount above zero.",
	3: "These rules aren't valid.",
	4: "Pick one of the organization's roles.",
	5: "This person is already part of the organization.",
	6: "You created this request, so someone else has to approve it.",
	7: "You've already approved this request.",
	8: "Your role can't approve this request.",
	9: "Your approval isn't needed: the remaining approvals must come from a higher role.",
	10: "This request is no longer waiting for approvals.",
	11: "This request doesn't need the security seal.",
	12: "This request already has the security seal.",
	13: "This request can't be declined.",
	14: "This request can't be executed yet.",
	15: "This change needs approval now that your organization has enough people.",
	16: "After this change, nobody could approve large payments or changes anymore.",
	17: "There isn't enough money available on the account.",
	18: "This request doesn't exist.",
	19: "Only the founder can do this during setup.",
	20: "Unknown template.",
	21: "That text is too long.",
	22: "This organization doesn't hold that asset.",
	23: "The organization already accepts this asset.",
	24: "This asset still holds money or has open requests, so it can't be removed.",
	25: "An organization has to accept at least one asset.",
	26: "This asset has no Reserve yet.",
	27: "Your role can't move money between the account and the Reserve.",
	28: "Only the organization's highest role can change the logo.",
	29: "A spending limit needs an amount above zero and a period.",
};

const variant = (value: unknown): [string, unknown[]] => {
	if (Array.isArray(value) && typeof value[0] === "string") return [value[0], value.slice(1)];
	throw new Error(`Expected an enum value, got ${JSON.stringify(value)}`);
};
const num = (value: unknown): number => Number(value);
const big = (value: unknown): bigint => BigInt(value as bigint | number | string);
const seconds = (value: unknown): number => num(value) * 1000;
const str = (value: unknown): string => String(value);

function roleOf(templateId: TemplateId | null, id: string): Role {
	const known = templateId ? templates[templateId].roles.find((r) => r.id === id) : undefined;
	return known ?? { id, name: id, plural: `${id}s` };
}

function requirements(value: unknown): Requirement[] {
	return (value as Native[]).map((r) => ({ roleId: str(r.role), count: num(r.count) }));
}

export function mapPolicy(native: Native): Policy {
	return {
		tiers: (native.tiers as Native[]).map((tier) => ({
			upTo: tier.up_to === null || tier.up_to === undefined ? null : toCents(big(tier.up_to)),
			approvals: requirements(tier.approvals),
			objectionWindowHours: num(tier.objection_window_hours),
		})),
		sealThreshold: toCents(big(native.seal_threshold)),
		newRecipientApprovals: requirements(native.new_recipient_approvals),
	};
}

function mapEvaluation(native: Native): Evaluation {
	return {
		tierIndex: native.tier === null || native.tier === undefined ? null : num(native.tier),
		approvals: requirements(native.approvals),
		objectionWindowHours: num(native.objection_window_hours),
		sealRequired: Boolean(native.seal_required),
		withinLimit: Boolean(native.within_limit),
	};
}

export function mapLimit(native: Native): SpendingLimit {
	return {
		amount: toCents(big(native.amount)),
		periodSeconds: num(native.period_seconds),
		spent: toCents(big(native.spent)),
		windowStart: seconds(native.window_start),
	};
}

const currency = (value: unknown): Currency => (str(value) === "EUR" ? "EUR" : "USD");

/** Several testnet tokens call themselves "USDC"; the allowlist name tells them apart. */
export type SymbolLookup = (token: string, onchainSymbol: string) => string;

export function mapAsset(native: Native, symbolOf: SymbolLookup = (_, s) => s): Asset {
	const token = str(native.token);
	return {
		token,
		symbol: symbolOf(token, str(native.symbol)),
		currency: currency(native.currency),
		vault: native.vault ? str(native.vault) : null,
	};
}

function mapChange(value: unknown): GovernanceChange {
	const [kind, fields] = variant(value);
	switch (kind) {
		case "AddMember":
			return { type: "addMember", personId: str(fields[0]), roleId: str(fields[1]) };
		case "RemoveMember":
			return { type: "removeMember", personId: str(fields[0]) };
		case "ChangeRole":
			return { type: "changeRole", personId: str(fields[0]), roleId: str(fields[1]) };
		case "UpdatePolicy":
			return { type: "updatePolicy", policy: mapPolicy(fields[0] as Native) };
		case "AddAsset": {
			// The spec names the token and currency; the symbol is read once the asset is accepted.
			const spec = fields[0] as Native;
			return {
				type: "addAsset",
				asset: {
					token: str(spec.token),
					symbol: shortAddress(str(spec.token)),
					currency: currency(spec.currency),
					vault: spec.vault ? str(spec.vault) : null,
				},
			};
		}
		case "RemoveAsset":
			return { type: "removeAsset", token: str(fields[0]) };
		case "SetSpendingLimit":
			return {
				type: "setSpendingLimit",
				personId: str(fields[0]),
				amount: toCents(big(fields[1])),
				periodSeconds: num(fields[2]),
			};
		default:
			throw new Error(`Unknown change ${kind}`);
	}
}

export function mapRequest(
	native: Native,
	now: number,
	assets: readonly Asset[] = [],
): ApprovalRequest {
	const createdAt = seconds(native.created_at);
	const executeAfter =
		native.execute_after === null || native.execute_after === undefined
			? null
			: seconds(native.execute_after);
	// The contract keeps "Scheduled" until someone calls execute; once the window has passed the
	// request is ready to go out.
	const status = STATUS[variant(native.status)[0]] ?? "failed";
	const base = {
		id: String(native.id),
		requesterId: str(native.requester),
		createdAt,
		evaluation: mapEvaluation(native.evaluation as Native),
		// The contract records who approved, not when; the request's creation time stands in.
		approvals: (native.approvals as unknown[]).map((who) => ({
			personId: str(who),
			at: createdAt,
		})),
		sealedBy:
			native.sealed_by === null || native.sealed_by === undefined ? null : str(native.sealed_by),
		status:
			status === "scheduled" && executeAfter !== null && executeAfter <= now ? "ready" : status,
		executeAfter,
		declinedBy:
			native.decided_by === null || native.decided_by === undefined ? null : str(native.decided_by),
		failure:
			native.failure === null || native.failure === undefined
				? null
				: ruleError(
						ERROR_CODES[num(native.failure) - 1] ?? "not-allowed",
						CONTRACT_ERROR_MESSAGES[num(native.failure)] ?? "The change could not be applied.",
					),
		executionRef: null,
	};
	const [kind, fields] = variant(native.kind);
	if (kind === "Payment") {
		const payment = fields[0] as Native;
		const token = str(payment.token);
		return {
			...base,
			kind: "payment",
			token,
			currency: assets.find((a) => a.token === token)?.currency ?? "USD",
			amount: toCents(big(payment.amount)),
			recipientId: str(payment.to),
			recipientIsNew: false,
			note: str(payment.memo),
		};
	}
	return { ...base, kind: "governance", change: mapChange(fields[0]) };
}

/** Names for recipient addresses: other organizations by name, everyone else shortened. */
export type NameLookup = (address: string) => string | undefined;

export function mapOrganization(
	snapshot: OnchainSnapshot,
	nameOf: NameLookup,
	now: number = Date.now(),
	symbolOf?: SymbolLookup,
): OrgAccount {
	const info = snapshot.info;
	const templateId =
		(["club", "company", "team"] as const).find((t) => t === str(info.template)) ?? null;
	const roles = (info.roles as unknown[]).map((id) => roleOf(templateId, str(id)));
	const assets = snapshot.assets.map((asset) => mapAsset(asset, symbolOf));
	const org: Org = {
		id: snapshot.contractId,
		name: str(info.name),
		templateId: templateId ?? "club",
		roles,
		members: snapshot.members.map((m) => {
			const limit = snapshot.limits.get(str(m.address));
			return { personId: str(m.address), roleId: str(m.role), ...(limit ? { limit } : {}) };
		}),
		policy: mapPolicy(snapshot.policy),
		founderId: str(info.founder),
		baseCurrency: currency(info.base_currency),
		assets,
	};
	const requests = snapshot.requests.map((r) => mapRequest(r, now, assets));
	const payees = new Map<string, Payee>();
	for (const request of requests) {
		if (request.kind === "payment" && !payees.has(request.recipientId)) {
			payees.set(request.recipientId, {
				id: request.recipientId,
				name: nameOf(request.recipientId) ?? shortAddress(request.recipientId),
				account: request.recipientId,
			});
		}
	}
	const activity: ActivityEntry[] = requests
		.filter((r) => r.status === "executed")
		.map((r) =>
			r.kind === "payment"
				? {
						id: `req-${r.id}`,
						at: r.createdAt,
						actorId: r.requesterId,
						kind: "payment-out",
						token: r.token,
						amount: r.amount,
						payeeId: r.recipientId,
						txHash: null,
					}
				: {
						id: `req-${r.id}`,
						at: r.createdAt,
						actorId: r.requesterId,
						kind: "governance",
						change: r.change,
						viaRequest: true,
					},
		);
	return {
		org,
		onchain: {
			contractId: snapshot.contractId,
			setupPhase: snapshot.setupPhase,
			policyHash: snapshot.policyHash,
		},
		balances: assets.map((asset) => {
			const reserve = snapshot.reserves.get(asset.token);
			return {
				token: asset.token,
				balance: toCents(snapshot.balances.get(asset.token) ?? 0n),
				reserve: toCents(reserve?.value ?? 0n),
				...(reserve ? { earnings: toCents(reserve.value - reserve.principal) } : {}),
			};
		}),
		reserveRateBps: 410,
		accountNumber: null,
		logoUrl: info.logo ? str(info.logo) : null,
		payees: [...payees.values()],
		requests,
		activity,
		discussions: {},
		budgets: [],
	};
}
