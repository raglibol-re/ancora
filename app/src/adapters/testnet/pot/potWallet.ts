import { commit, modR, type Point, Q } from "./potCurve.ts";
import { DOMAIN, type Hasher } from "./potHash.ts";
import type { PotKeys } from "./potKeys.ts";
import type { Opening } from "./potWitness.ts";

// The organization's pot balance rebuilt from the pot's events (docs/protocol/wallet-state.md):
// what it can spend (C_spend) and what it received since the last merge (C_receive), with the
// openings needed to prove the next spend. Replay runs oldest first over whatever history is
// available: a withdrawal or payment (a checkpoint) pins the spendable side from its encrypted
// balance; a merge pins the receiving side at zero. The result counts only if it reproduces
// both commitments on-chain; otherwise the history was too short and the balance stays unread.

export type PotEvent = { id: string; ledger: number; at: number } & (
	| { kind: "register"; account: string }
	| { kind: "deposit"; from: string; to: string; amount: bigint }
	| { kind: "merge"; account: string }
	| { kind: "withdraw"; from: string; to: string; amount: bigint; sigma: bigint; bTilde: bigint }
	| {
			kind: "transfer";
			from: string;
			to: string;
			ephemeral: Point;
			vTilde: bigint;
			sigma: bigint;
			bTilde: bigint;
			vTildeAudS: bigint;
	  }
);

/** One movement of the pot as its members read it; amounts in the asset's minor units. */
export type PotEntry = {
	id: string;
	at: number;
	kind: "deposit" | "withdraw" | "sent" | "received";
	amount: bigint;
	counterparty: string;
};

export type PotBalance = { spendable: Opening; receiving: Opening; entries: PotEntry[] };

type Side = Opening | null;

const add = (a: Opening, b: Opening): Opening => ({
	value: a.value + b.value,
	blinding: a.blinding + b.blinding,
});

/** Does `opening` open `point`? Blindings add up in q, so it is reduced there to compare. */
const opens = (opening: Opening, point: Point) =>
	commit(opening.value, ((opening.blinding % Q) + Q) % Q).equals(point);

/**
 * The pot account of `me` from its events, checked against the commitments on-chain; null when
 * the events don't reach far enough back to explain them.
 */
export function replay(
	hasher: Hasher,
	keys: PotKeys,
	me: string,
	events: readonly PotEvent[],
	onChain: { spendable: Point; receiving: Point },
): PotBalance | null {
	let spendable: Side = null;
	let receiving: Side = null;
	const entries: PotEntry[] = [];
	const checkpoint = (sigma: bigint, bTilde: bigint): Opening => ({
		value: modR(bTilde - hasher.hash(DOMAIN.encryptedBalance, [keys.view, sigma])),
		blinding: hasher.hash(DOMAIN.spendRandomness, [keys.view, sigma]),
	});
	for (const event of events) {
		const base = { id: event.id, at: event.at };
		switch (event.kind) {
			case "register":
				if (event.account === me) {
					spendable = { value: 0n, blinding: 0n };
					receiving = { value: 0n, blinding: 0n };
				}
				break;
			case "deposit":
				if (event.to === me) {
					receiving = receiving && add(receiving, { value: event.amount, blinding: 0n });
					entries.push({
						...base,
						kind: "deposit",
						amount: event.amount,
						counterparty: event.from,
					});
				}
				break;
			case "merge":
				if (event.account === me) {
					spendable = spendable && receiving && add(spendable, receiving);
					receiving = { value: 0n, blinding: 0n };
				}
				break;
			case "withdraw":
				if (event.from === me) {
					spendable = checkpoint(event.sigma, event.bTilde);
					entries.push({ ...base, kind: "withdraw", amount: event.amount, counterparty: event.to });
				}
				break;
			case "transfer":
				if (event.from === me) {
					spendable = checkpoint(event.sigma, event.bTilde);
					// The sender's own auditor channel carries the amount; the organization holds
					// that auditor key.
					const shared = hasher.ecdh(keys.auditor, event.ephemeral);
					const [mask] = hasher.squeeze3(DOMAIN.auditorSender, shared, event.sigma);
					entries.push({
						...base,
						kind: "sent",
						amount: modR(event.vTildeAudS - mask),
						counterparty: event.to,
					});
				}
				if (event.to === me) {
					const shared = hasher.ecdh(keys.view, event.ephemeral);
					const received = {
						value: modR(event.vTilde - hasher.hash(DOMAIN.transferAmount, [shared, event.sigma])),
						blinding: hasher.hash(DOMAIN.transferBlinding, [shared, event.sigma]),
					};
					receiving = receiving && add(receiving, received);
					entries.push({
						...base,
						kind: "received",
						amount: received.value,
						counterparty: event.from,
					});
				}
				break;
		}
	}
	if (!spendable || !receiving) return null;
	if (!opens(spendable, onChain.spendable) || !opens(receiving, onChain.receiving)) return null;
	return { spendable, receiving, entries: entries.reverse() };
}
