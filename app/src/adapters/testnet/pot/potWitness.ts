import {
	commit,
	coordinates,
	fieldBytes,
	H,
	hex,
	modR,
	mul,
	type Point,
	pointBytes,
	Q,
	R,
	sampleScalar,
} from "./potCurve.ts";
import { DOMAIN, type Hasher } from "./potHash.ts";
import type { PotKeys } from "./potKeys.ts";

// Witnesses and payloads for the three circuits an organization proves: register, withdraw and
// transfer. Every constraint id in the comments is the circuit's own (circuits/*/src/main.nr);
// the payload fields are the contract's (storage.rs `*Payload`), and the contract loads every
// other public input from its state, so they are not sent.

/** What the wallet knows about a balance commitment: its value and blinding. */
export type Opening = { value: bigint; blinding: bigint };

/** Noir's input map: every value a 0x-prefixed field element. */
export type CircuitInputs = Record<string, string>;

export type Built = {
	inputs: CircuitInputs;
	/** The payload's fields, to encode for the contract. */
	payload: Record<string, Uint8Array>;
	/** The spendable opening once the operation lands. */
	spendable: Opening;
};

export class PotWitnessError extends Error {}

const pointInputs = (name: string, point: Point) => {
	const { x, y } = coordinates(point);
	return { [`${name}_x`]: hex(x), [`${name}_y`]: hex(y) };
};

/**
 * The current spendable opening as a circuit witness: its blinding reduced modulo q. A sum of
 * blindings lands at or above r once in about 2^127 merges; then no proof can spend it until
 * another incoming payment is merged (docs/protocol/proof-system.md).
 */
function witnessOf(opening: Opening): { v: bigint; r: bigint } {
	const r = ((opening.blinding % Q) + Q) % Q;
	if (r >= R) {
		throw new PotWitnessError(
			"The pot's balance can't be spent right now. Merge the next payment it receives and try again.",
		);
	}
	return { v: opening.value, r };
}

/** A fresh salt and the ephemeral scalar it gives (never zero, as W8/T13 require). */
function salted(hasher: Hasher, view: bigint) {
	for (;;) {
		const sigma = sampleScalar();
		const ephemeral = hasher.hash(DOMAIN.ephemeral, [view, sigma]);
		if (ephemeral !== 0n) return { sigma, ephemeral };
	}
}

export function buildRegister(keys: PotKeys, addrF: bigint, acctF: bigint): Built {
	return {
		inputs: {
			sk: hex(keys.spend),
			y_x: hex(coordinates(keys.spendingKey).x),
			y_y: hex(coordinates(keys.spendingKey).y),
			pvk_x: hex(coordinates(keys.viewingKey).x),
			pvk_y: hex(coordinates(keys.viewingKey).y),
			addr_f: hex(addrF),
			_acct_f: hex(acctF),
		},
		payload: { y: pointBytes(keys.spendingKey), pvk: pointBytes(keys.viewingKey) },
		spendable: { value: 0n, blinding: 0n },
	};
}

type Spend = {
	hasher: Hasher;
	keys: PotKeys;
	addrF: bigint;
	/** The current spendable commitment, as read from the pot. */
	current: Point;
	opening: Opening;
	/** The organization's own auditor key (the sender's auditor). */
	senderAuditor: Point;
	amount: bigint;
};

/** The parts withdraw and transfer share: new balance, its checkpoint and the auditor escrow. */
function spendParts({ hasher, keys, addrF, current, opening, senderAuditor, amount }: Spend) {
	const { v, r } = witnessOf(opening);
	if (amount <= 0n || amount > v) throw new PotWitnessError("The pot doesn't hold that much.");
	if (!commit(v, r).equals(current)) {
		throw new PotWitnessError("The pot's balance changed. Refresh and try again.");
	}
	const { sigma, ephemeral } = salted(hasher, keys.view);
	const remaining = v - amount;
	const blinding = hasher.hash(DOMAIN.spendRandomness, [keys.view, sigma]);
	const masks = hasher.squeeze3(DOMAIN.auditorSender, hasher.ecdh(ephemeral, senderAuditor), sigma);
	return {
		v,
		r,
		sigma,
		ephemeral,
		remaining,
		blinding,
		next: commit(remaining, blinding),
		bTilde: modR(remaining + hasher.hash(DOMAIN.encryptedBalance, [keys.view, sigma])),
		senderMasks: masks,
		common: {
			sk: hex(keys.spend),
			v: hex(v),
			r: hex(r),
			r_e: hex(ephemeral),
			...pointInputs("c_spend", current),
			...pointInputs("y", keys.spendingKey),
			addr_f: hex(addrF),
			...pointInputs("k_aud_s", senderAuditor),
		},
	};
}

/** Takes `amount` (minor units of the asset) out of the pot, back to a public account. */
export function buildWithdraw(spend: Spend): Built {
	const p = spendParts(spend);
	const ephemeralPoint = mul(H, p.ephemeral);
	const bTildeAudS = modR(p.remaining + p.senderMasks[1]);
	const rTildeAudS = modR(p.blinding + p.senderMasks[2]);
	return {
		inputs: {
			...p.common,
			a: hex(spend.amount),
			...pointInputs("c_spend_new", p.next),
			sigma: hex(p.sigma),
			b_tilde: hex(p.bTilde),
			...pointInputs("r_e", ephemeralPoint),
			b_tilde_aud_s: hex(bTildeAudS),
			r_tilde_aud_s: hex(rTildeAudS),
		},
		payload: {
			c_spend_new: pointBytes(p.next),
			b_tilde: fieldBytes(p.bTilde),
			r_e_point: pointBytes(ephemeralPoint),
			sigma: fieldBytes(p.sigma),
			b_tilde_aud_s: fieldBytes(bTildeAudS),
			r_tilde_aud_s: fieldBytes(rTildeAudS),
		},
		spendable: { value: p.remaining, blinding: p.blinding },
	};
}

/** Pays `amount` to another pot account; only the two parties and their auditors learn it. */
export function buildTransfer(
	spend: Spend & { recipientViewingKey: Point; recipientAuditor: Point },
): Built {
	const { hasher } = spend;
	const p = spendParts(spend);
	const ephemeralPoint = mul(H, p.ephemeral);
	const shared = hasher.ecdh(p.ephemeral, spend.recipientViewingKey);
	const transferBlinding = hasher.hash(DOMAIN.transferBlinding, [shared, p.sigma]);
	const transfer = commit(spend.amount, transferBlinding);
	const vTilde = modR(spend.amount + hasher.hash(DOMAIN.transferAmount, [shared, p.sigma]));
	const recipientMasks = hasher.squeeze3(
		DOMAIN.auditorRecipient,
		hasher.ecdh(p.ephemeral, spend.recipientAuditor),
		p.sigma,
	);
	const fields = {
		v_tilde: vTilde,
		b_tilde: p.bTilde,
		sigma: p.sigma,
		v_tilde_aud_r: modR(spend.amount + recipientMasks[0]),
		r_tilde_aud_r: modR(transferBlinding + recipientMasks[1]),
		v_tilde_aud_s: modR(spend.amount + p.senderMasks[0]),
		b_tilde_aud_s: modR(p.remaining + p.senderMasks[1]),
		r_tilde_aud_s: modR(p.blinding + p.senderMasks[2]),
	};
	return {
		inputs: {
			...p.common,
			v_transfer: hex(spend.amount),
			...pointInputs("pvk_b", spend.recipientViewingKey),
			...pointInputs("k_aud_r", spend.recipientAuditor),
			...pointInputs("c_spend_new", p.next),
			...pointInputs("c_transfer", transfer),
			...pointInputs("r_e", ephemeralPoint),
			...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, hex(v)])),
		},
		payload: {
			c_spend_new: pointBytes(p.next),
			c_transfer: pointBytes(transfer),
			r_e_point: pointBytes(ephemeralPoint),
			...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fieldBytes(v)])),
		},
		spendable: { value: p.remaining, blinding: p.blinding },
	};
}
