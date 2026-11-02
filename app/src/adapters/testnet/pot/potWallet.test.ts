import { beforeAll, describe, expect, it } from "vitest";
import { commit, fieldOf, IDENTITY, type Point, pointOf, Q } from "./potCurve.ts";
import { type Hasher, loadHasher } from "./potHash.ts";
import { type PotKeys, potKeys } from "./potKeys.ts";
import { type PotEvent, replay } from "./potWallet.ts";
import { type Built, buildTransfer, type Opening } from "./potWitness.ts";

// A pot account's life as events, built with the same witness code that proves, replayed.

const POT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const ME = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const THEM = "CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L";

let hasher: Hasher;
let me: PotKeys;
let them: PotKeys;
beforeAll(async () => {
	hasher = await loadHasher();
	me = await potKeys(hasher, new Uint8Array(32).fill(1), POT, ME);
	them = await potKeys(hasher, new Uint8Array(32).fill(2), POT, THEM);
}, 60_000);

const field = (built: Built, name: string) => fieldOf(built.payload[name] ?? new Uint8Array());
const point = (built: Built, name: string) => pointOf(built.payload[name] ?? new Uint8Array(64));
let n = 0;
const at = () => ({ id: `e${++n}`, ledger: n, at: n * 1000 });

/** `from` pays `to` `amount` out of `opening`, as the pot's event records it. */
function payment(
	from: PotKeys,
	fromId: string,
	to: PotKeys,
	toId: string,
	opening: Opening,
	amount: bigint,
) {
	const addrF = hasher.addressToField(POT);
	const built = buildTransfer({
		hasher,
		keys: from,
		addrF,
		current: commit(opening.value, ((opening.blinding % Q) + Q) % Q),
		opening,
		senderAuditor: from.auditorKey,
		amount,
		recipientViewingKey: to.viewingKey,
		recipientAuditor: to.auditorKey,
	});
	const event: PotEvent = {
		...at(),
		kind: "transfer",
		from: fromId,
		to: toId,
		ephemeral: point(built, "r_e_point"),
		vTilde: field(built, "v_tilde"),
		sigma: field(built, "sigma"),
		bTilde: field(built, "b_tilde"),
		vTildeAudS: field(built, "v_tilde_aud_s"),
	};
	return { built, event, transfer: point(built, "c_transfer") };
}

describe("the pot balance from its events", () => {
	it("follows deposits, merges, payments out and in, and matches the chain", () => {
		const events: PotEvent[] = [
			{ ...at(), kind: "register", account: ME },
			{ ...at(), kind: "deposit", from: ME, to: ME, amount: 1_000n },
			{ ...at(), kind: "merge", account: ME },
		];
		const out = payment(me, ME, them, THEM, { value: 1_000n, blinding: 0n }, 300n);
		events.push(out.event);
		const incoming = payment(them, THEM, me, ME, { value: 500n, blinding: 7n }, 120n);
		events.push(incoming.event);

		const onChain = { spendable: point(out.built, "c_spend_new"), receiving: incoming.transfer };
		const balance = replay(hasher, me, ME, events, onChain);
		expect(balance?.spendable.value).toBe(700n);
		expect(balance?.receiving.value).toBe(120n);
		expect(balance?.entries.map((e) => [e.kind, e.amount])).toEqual([
			["received", 120n],
			["sent", 300n],
			["deposit", 1_000n],
		]);
	});

	it("starts from a checkpoint when the registration is older than the history", () => {
		const out = payment(me, ME, them, THEM, { value: 900n, blinding: 55n }, 100n);
		const events: PotEvent[] = [{ ...at(), kind: "merge", account: ME }, out.event];
		const onChain = { spendable: point(out.built, "c_spend_new"), receiving: IDENTITY };
		expect(replay(hasher, me, ME, events, onChain)?.spendable.value).toBe(800n);
	});

	it("reads nothing when the history can't explain the chain", () => {
		const events: PotEvent[] = [{ ...at(), kind: "deposit", from: ME, to: ME, amount: 5n }];
		const onChain: { spendable: Point; receiving: Point } = {
			spendable: IDENTITY,
			receiving: commit(5n, 0n),
		};
		expect(replay(hasher, me, ME, events, onChain)).toBeNull();
	});
});
