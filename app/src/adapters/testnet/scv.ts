import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type { Cents } from "../../domain/money.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import type { Policy, Requirement } from "../../domain/rules/model.ts";

// Encoders for the organization contract's argument types. Amounts on-chain are USDC minor
// units (7 decimals); the app works in cents.

export const STROOPS_PER_CENT = 100_000n;

export const toStroops = (cents: Cents): bigint => BigInt(cents) * STROOPS_PER_CENT;

/** Rounds down to whole cents; the contract never pays fractions of a cent. */
export const toCents = (stroops: bigint): Cents => Number(stroops / STROOPS_PER_CENT);

export const address = (value: string): xdr.ScVal => new Address(value).toScVal();
export const symbol = (value: string): xdr.ScVal => xdr.ScVal.scvSymbol(value);
export const text = (value: string): xdr.ScVal => xdr.ScVal.scvString(value);
export const u32 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u32" });
export const u64 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u64" });
export const i128 = (value: bigint): xdr.ScVal => nativeToScVal(value, { type: "i128" });

/** A `#[contracttype]` struct: a map with its field names as sorted symbol keys. */
function struct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
	const entries = Object.keys(fields)
		.sort()
		.flatMap((key) => {
			const val = fields[key];
			return val ? [new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })] : [];
		});
	return xdr.ScVal.scvMap(entries);
}

const requirement = (r: Requirement): xdr.ScVal =>
	struct({ count: u32(r.count), role: symbol(r.roleId) });

export function policyToScVal(policy: Policy): xdr.ScVal {
	return struct({
		new_recipient_approvals: xdr.ScVal.scvVec(policy.newRecipientApprovals.map(requirement)),
		seal_threshold: i128(toStroops(policy.sealThreshold)),
		tiers: xdr.ScVal.scvVec(
			policy.tiers.map((tier) =>
				struct({
					approvals: xdr.ScVal.scvVec(tier.approvals.map(requirement)),
					objection_window_hours: u32(tier.objectionWindowHours),
					up_to: tier.upTo === null ? xdr.ScVal.scvVoid() : i128(toStroops(tier.upTo)),
				}),
			),
		),
	});
}

/** The contract's `AssetSpec`: a token to accept and the currency it stands for. */
export const assetSpec = (token: string, currency: string, vault: string | null): xdr.ScVal =>
	struct({
		currency: symbol(currency),
		token: address(token),
		vault: vault ? address(vault) : xdr.ScVal.scvVoid(),
	});

/**
 * The contract's `Change` enum. Rule updates carry the SHA-256 of their policy document (hex);
 * template switching has no on-chain counterpart yet.
 */
export function changeToScVal(change: GovernanceChange, policyHashHex?: string): xdr.ScVal | null {
	switch (change.type) {
		case "addMember":
			return xdr.ScVal.scvVec([
				symbol("AddMember"),
				address(change.personId),
				symbol(change.roleId),
			]);
		case "removeMember":
			return xdr.ScVal.scvVec([symbol("RemoveMember"), address(change.personId)]);
		case "changeRole":
			return xdr.ScVal.scvVec([
				symbol("ChangeRole"),
				address(change.personId),
				symbol(change.roleId),
			]);
		case "updatePolicy":
			if (!policyHashHex) return null;
			return xdr.ScVal.scvVec([
				symbol("UpdatePolicy"),
				policyToScVal(change.policy),
				xdr.ScVal.scvBytes(Buffer.from(policyHashHex, "hex")),
			]);
		case "addAsset":
			return xdr.ScVal.scvVec([
				symbol("AddAsset"),
				assetSpec(change.asset.token, change.asset.currency, change.asset.vault ?? null),
			]);
		case "removeAsset":
			return xdr.ScVal.scvVec([symbol("RemoveAsset"), address(change.token)]);
		case "switchTemplate":
			return null;
	}
}
