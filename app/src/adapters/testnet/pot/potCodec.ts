import { xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type { PotAction } from "../../../domain/rules/requests.ts";
import { address, i128, struct, toCents, toStroops, u32 } from "../scv.ts";

// The organization contract's `PotAction` and `PotCall` in XDR, and back.

const tagged = (name: string, ...fields: xdr.ScVal[]) =>
	xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name), ...fields]);
const bytes = (data: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(data));

/** What a pot step sends: the action and, for proof-carrying ones, the pot's `data`. */
export type PotStep =
	| { type: "register"; auditorId: number; data: Uint8Array }
	| { type: "deposit"; amount: bigint }
	| { type: "withdraw"; amount: bigint; data: Uint8Array }
	| { type: "pay"; to: string; data: Uint8Array };

function stepToScVal(step: PotStep): xdr.ScVal {
	switch (step.type) {
		case "register":
			return tagged("Register", u32(step.auditorId), bytes(step.data));
		case "deposit":
			return tagged("Deposit", i128(step.amount));
		case "withdraw":
			return tagged("Withdraw", i128(step.amount), bytes(step.data));
		case "pay":
			return tagged("Transfer", address(step.to), bytes(step.data));
	}
}

/** The organization contract's `PotCall`; what it holds back is set by the contract itself. */
export function potCallToScVal(pot: string, step: PotStep): xdr.ScVal {
	return struct({
		action: stepToScVal(step),
		pot: address(pot),
		reserved_amount: i128(0n),
		reserved_token: xdr.ScVal.scvVoid(),
	});
}

/** A `PotAction` as `scValToNative` gives it: `[variant, ...fields]`. */
export function mapPotAction(native: unknown): PotAction {
	if (!Array.isArray(native) || typeof native[0] !== "string") {
		throw new Error(`Expected a pot action, got ${JSON.stringify(native)}`);
	}
	const [name, first, second] = native as [string, unknown, unknown];
	const cents = (value: unknown) => toCents(BigInt(String(value)));
	switch (name) {
		case "Register":
			return { type: "register" };
		case "Deposit":
			return { type: "deposit", amount: cents(first) };
		case "Withdraw":
			return { type: "withdraw", amount: cents(first) };
		case "Transfer":
			return {
				type: "pay",
				to: String(first),
				sealed: second instanceof Uint8Array ? Buffer.from(second).toString("base64") : "",
			};
		default:
			throw new Error(`Unknown pot action ${name}`);
	}
}

/** Cents as the pot's minor units. */
export const potAmount = (cents: number) => toStroops(cents);
