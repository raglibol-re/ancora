import { weierstrass } from "@noble/curves/abstract/weierstrass.js";

// The confidential pot's curve arithmetic, as OpenZeppelin's circuits fix it
// (stellar-confidential 0.8.0, circuits/lib/src/lib.nr). Grumpkin's coordinates live in BN254's
// scalar field r (Noir's Field); its group order is BN254's base field q. Values are exact
// integers; blindings add in q; everything sent out is a canonical r element.

/** BN254 scalar field: Noir's Field and Grumpkin's coordinate field. */
export const R = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
/** BN254 base field: Grumpkin's group order, where commitment blindings add up. */
export const Q = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;

const Grumpkin = weierstrass({
	p: R,
	n: Q,
	h: 1n,
	a: 0n,
	b: R - 17n,
	Gx: 0x083e7911d835097629f0067531fc15cafd79a89beecb39903f69572c636f4a5an,
	Gy: 0x1a7f5efaad7f315c25a918f30cc8d7333fccab7ad7c90f14de81bcc528f9935dn,
});

export type Point = InstanceType<typeof Grumpkin>;

/** Barretenberg's Pedersen generators 0 and 1 of "DEFAULT_DOMAIN_SEPARATOR". */
export const G: Point = Grumpkin.BASE;
export const H: Point = Grumpkin.fromAffine({
	x: 0x054aa86a73cb8a34525e5bbed6e43ba1198e860f5f3950268f71df4591bde402n,
	y: 0x209dcfbf2cfb57f9f6046f44d71ac6faf87254afc7407c04eb621a6287cac126n,
});
export const IDENTITY: Point = Grumpkin.ZERO;

/** `k · P`; a zero scalar gives the identity (deposits commit with blinding 0). */
export function mul(point: Point, scalar: bigint): Point {
	const k = ((scalar % Q) + Q) % Q;
	return k === 0n ? IDENTITY : point.multiply(k);
}

/** The Pedersen commitment `v·G + r·H`. */
export const commit = (value: bigint, blinding: bigint): Point =>
	mul(G, value).add(mul(H, blinding));

/** Affine coordinates; the identity is (0, 0), as on-chain. */
export function coordinates(point: Point): { x: bigint; y: bigint } {
	return point.equals(IDENTITY) ? { x: 0n, y: 0n } : point.toAffine();
}

export class PotEncodingError extends Error {}

/** 32 bytes big-endian of a canonical r element. */
export function fieldBytes(value: bigint): Uint8Array {
	if (value < 0n || value >= R) throw new PotEncodingError("A value is outside the field.");
	return Uint8Array.from({ length: 32 }, (_, i) => Number((value >> BigInt(8 * (31 - i))) & 0xffn));
}

export function fieldOf(bytes: Uint8Array): bigint {
	let value = 0n;
	for (const byte of bytes) value = (value << 8n) | BigInt(byte);
	if (value >= R) throw new PotEncodingError("A value read from the pot is outside the field.");
	return value;
}

/** The flat 64-byte form: x then y, big-endian; the identity is 64 zero bytes. */
export function pointBytes(point: Point): Uint8Array {
	const { x, y } = coordinates(point);
	return Uint8Array.from([...fieldBytes(x), ...fieldBytes(y)]);
}

export function pointOf(bytes: Uint8Array): Point {
	if (bytes.length !== 64) throw new PotEncodingError("A curve point must be 64 bytes.");
	const x = fieldOf(bytes.slice(0, 32));
	const y = fieldOf(bytes.slice(32));
	return x === 0n && y === 0n ? IDENTITY : Grumpkin.fromAffine({ x, y });
}

/** A field element as Noir takes it. */
export const hex = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

/** `a mod r`, for field sums the circuits take (masks, encrypted scalars). */
export const modR = (value: bigint) => ((value % R) + R) % R;

/**
 * A uniformly random nonzero field element: 32 random bytes, the top two bits cleared, redrawn
 * while it is not below r (the specification's rejection sampling).
 */
export function sampleScalar(): bigint {
	for (;;) {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		bytes[0] = (bytes[0] ?? 0) & 0x3f;
		let value = 0n;
		for (const byte of bytes) value = (value << 8n) | BigInt(byte);
		if (value !== 0n && value < R) return value;
	}
}
