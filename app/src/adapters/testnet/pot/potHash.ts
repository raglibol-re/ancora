import { coordinates, IDENTITY, mul, type Point, R } from "./potCurve.ts";

// Poseidon2 as the circuits use it: Barretenberg's width-4 permutation (from bb.js, the same
// code that proves) in a rate-3 sponge whose capacity lane starts at (absorbed length)·2^64,
// with the domain tag absorbed first. Loading bb.js takes a moment, so it happens once, on
// first use of the pot.

/** The domain tags, fixed by the specification (docs/protocol/domain-separators.md). */
export const DOMAIN = {
	address: 1n,
	viewingKey: 2n,
	spendRandomness: 4n,
	transferBlinding: 5n,
	transferAmount: 6n,
	encryptedBalance: 7n,
	auditorSender: 11n,
	auditorRecipient: 12n,
	ecdh: 13n,
	/** Off-circuit: the deterministic ephemeral scalar r_e = Poseidon2(δ_eph, vk, σ). */
	ephemeral: 14n,
} as const;

type Permutation = (state: bigint[]) => bigint[];

export type Hasher = {
	/** `poseidon_with_domain(d, inputs)`. */
	hash: (domain: bigint, inputs: bigint[]) => bigint;
	/** Lanes 0..2 of one permutation of [d, s, sigma, 3·2^64] (SpongeSqueeze_3). */
	squeeze3: (domain: bigint, s: bigint, sigma: bigint) => [bigint, bigint, bigint];
	/** The ECDH shared scalar: Poseidon2 of both coordinates of `scalar · point`. */
	ecdh: (scalar: bigint, point: Point) => bigint;
	/** `address_to_field`: a strkey's two 28-byte halves, little-endian, hashed. */
	addressToField: (strkey: string) => bigint;
};

const IV_BASE = 1n << 64n;

export class PotHashError extends Error {}

export function hasherFrom(permute: Permutation): Hasher {
	// Mirrors `sponge` in circuits/lib/src/lib.nr: full blocks of three, then the rest (or one
	// empty block for no input at all).
	const sponge = (inputs: bigint[]) => {
		let state = [0n, 0n, 0n, BigInt(inputs.length) * IV_BASE];
		const absorb = (block: bigint[]) => {
			state = permute(state.map((lane, i) => (lane + (block[i] ?? 0n)) % R));
		};
		const full = Math.floor(inputs.length / 3);
		for (let i = 0; i < full; i++) absorb(inputs.slice(i * 3, i * 3 + 3));
		const rest = inputs.slice(full * 3);
		if (rest.length > 0 || inputs.length === 0) absorb(rest);
		return state[0] ?? 0n;
	};
	const hash = (domain: bigint, inputs: bigint[]) => sponge([domain, ...inputs]);
	const littleEndian = (bytes: Uint8Array) =>
		bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);
	return {
		hash,
		squeeze3: (domain, s, sigma) => {
			const [a = 0n, b = 0n, c = 0n] = permute([domain, s, sigma, 3n * IV_BASE]);
			return [a, b, c];
		},
		ecdh: (scalar, point) => {
			const shared = mul(point, scalar);
			if (shared.equals(IDENTITY)) throw new PotHashError("A shared secret came out empty.");
			const { x, y } = coordinates(shared);
			return hash(DOMAIN.ecdh, [x, y]);
		},
		addressToField: (strkey) => {
			const bytes = new TextEncoder().encode(strkey);
			if (bytes.length !== 56) throw new PotHashError("Not a Stellar address.");
			return hash(DOMAIN.address, [
				littleEndian(bytes.slice(0, 28)),
				littleEndian(bytes.slice(28)),
			]);
		},
	};
}

let loading: Promise<Hasher> | null = null;

/** The hasher, backed by bb.js's Poseidon2; loads bb.js on first call. */
export function loadHasher(): Promise<Hasher> {
	loading ??= import("@aztec/bb.js").then(async ({ BarretenbergSync, Fr }) => {
		const api = await BarretenbergSync.initSingleton();
		return hasherFrom((state) =>
			api.poseidon2Permutation(state.map((lane) => new Fr(lane))).map((f) => BigInt(f.toString())),
		);
	});
	return loading;
}
