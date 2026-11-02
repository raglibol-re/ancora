import { fieldBytes, H, mul, type Point, R } from "./potCurve.ts";
import { DOMAIN, type Hasher } from "./potHash.ts";

// An organization's keys for one pot. An organization is a contract address with no ed25519
// key of its own, so its keys come from a raw 32-byte root (docs/sdk/key-derivation.md, "Raw
// roots"), which ancora keeps encrypted in the keyring for the members (and auditors) who hold
// the organization's key. The spending key follows OpenZeppelin's derivation exactly; the
// auditor key is ancora's own (same recipe, another salt): the organization registers it as
// its auditor, so its auditor ciphertexts stay with whoever holds the root.

const SPEND_SALT = "openzeppelin/confidential-token/v1/sk";
const AUDITOR_SALT = "ancora/pot/v1/auditor";

export type PotKeys = {
	/** The spending secret sk. */
	spend: bigint;
	/** The contract-bound viewing key vk = Poseidon2(δ_vk, sk, addr_f). */
	view: bigint;
	/** Y = sk·H, registered as the spending public key. */
	spendingKey: Point;
	/** PVK = vk·H, registered as the viewing public key. */
	viewingKey: Point;
	/** The organization's auditor secret and its public key K = k·H. */
	auditor: bigint;
	auditorKey: Point;
};

export class PotKeyError extends Error {}

async function hkdf(root: Uint8Array, salt: string, info: Uint8Array): Promise<Uint8Array> {
	const base = await crypto.subtle.importKey("raw", Uint8Array.from(root), "HKDF", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-512",
			salt: new TextEncoder().encode(salt),
			info: Uint8Array.from(info),
		},
		base,
		256,
	);
	return new Uint8Array(bits);
}

/** HKDF output turned into a scalar: top two bits cleared, kept iff it is in [1, r). */
function scalarOf(bytes: Uint8Array): bigint | null {
	let value = 0n;
	bytes.forEach((byte, i) => {
		value = (value << 8n) | BigInt(i === 0 ? byte & 0x3f : byte);
	});
	return value > 0n && value < R ? value : null;
}

async function derive(
	root: Uint8Array,
	salt: string,
	addrF: bigint,
	acctF: bigint,
	accept: (scalar: bigint) => boolean,
): Promise<bigint> {
	for (let j = 0; j < 256; j++) {
		const info = Uint8Array.from([
			...fieldBytes(addrF),
			...fieldBytes(acctF),
			j & 0xff,
			(j >> 8) & 0xff,
			0,
			0,
		]);
		const scalar = scalarOf(await hkdf(root, salt, info));
		if (scalar !== null && accept(scalar)) return scalar;
	}
	throw new PotKeyError("Couldn't derive a key from this root.");
}

/** The organization's keys for the pot `pot` (strkey), from its 32-byte root. */
export async function potKeys(
	hasher: Hasher,
	root: Uint8Array,
	pot: string,
	organization: string,
): Promise<PotKeys> {
	if (root.length !== 32) throw new PotKeyError("A pot root is 32 bytes.");
	const addrF = hasher.addressToField(pot);
	const acctF = hasher.addressToField(organization);
	const viewOf = (sk: bigint) => hasher.hash(DOMAIN.viewingKey, [sk, addrF]);
	// Registration requires vk ≠ 0 (constraint R5), so a spending key that gives 0 is skipped.
	const spend = await derive(root, SPEND_SALT, addrF, acctF, (sk) => viewOf(sk) !== 0n);
	const view = viewOf(spend);
	const auditor = await derive(root, AUDITOR_SALT, addrF, acctF, () => true);
	return {
		spend,
		view,
		spendingKey: mul(H, spend),
		viewingKey: mul(H, view),
		auditor,
		auditorKey: mul(H, auditor),
	};
}
