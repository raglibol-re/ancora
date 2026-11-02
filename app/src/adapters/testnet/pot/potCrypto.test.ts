import { beforeAll, describe, expect, it } from "vitest";
import address from "../../../../../contracts/test-vectors/confidential/primitives/address_to_field.json";
import commitVector from "../../../../../contracts/test-vectors/confidential/primitives/commit.json";
import ecdhVector from "../../../../../contracts/test-vectors/confidential/primitives/ecdh.json";
import amount from "../../../../../contracts/test-vectors/confidential/primitives/encrypt_amount.json";
import balance from "../../../../../contracts/test-vectors/confidential/primitives/encrypt_balance.json";
import scalarMul from "../../../../../contracts/test-vectors/confidential/primitives/scalar_mul.json";
import squeeze from "../../../../../contracts/test-vectors/confidential/primitives/sponge_squeeze_3.json";
import viewing from "../../../../../contracts/test-vectors/confidential/primitives/vk_from_sk.json";
import { commit, coordinates, H, hex, modR, mul, pointBytes, pointOf } from "./potCurve.ts";
import { DOMAIN, type Hasher, loadHasher } from "./potHash.ts";

// OpenZeppelin's cross-language vectors: the client is correct only if it reproduces each one.

const big = (value: string) => BigInt(value);
const asHex = (point: ReturnType<typeof commit>) => {
	const { x, y } = coordinates(point);
	return { x: hex(x), y: hex(y) };
};

let hasher: Hasher;
beforeAll(async () => {
	hasher = await loadHasher();
}, 60_000);

describe("the pot's cryptography matches OpenZeppelin's vectors", () => {
	it("commits and multiplies on Grumpkin", () => {
		for (const v of commitVector.vectors) {
			expect(asHex(commit(big(v.inputs.value), big(v.inputs.randomness)))).toEqual(v.output);
		}
		for (const v of scalarMul.vectors)
			expect(asHex(mul(H, big(v.inputs.scalar)))).toEqual(v.output);
	});

	it("hashes with domains, squeezes and derives shared secrets", () => {
		for (const v of viewing.vectors) {
			expect(hex(hasher.hash(DOMAIN.viewingKey, [big(v.inputs.sk), big(v.inputs.wrap)]))).toBe(
				v.output,
			);
		}
		for (const v of squeeze.vectors) {
			const lanes = hasher.squeeze3(big(v.inputs.d), big(v.inputs.s), big(v.inputs.sigma));
			expect(lanes.map(hex)).toEqual(v.output);
		}
		for (const v of ecdhVector.vectors) {
			expect(hex(hasher.ecdh(big(v.inputs.scalar), H))).toBe(v.output);
		}
	});

	it("encrypts amounts and balances", () => {
		for (const v of amount.vectors) {
			const mask = hasher.hash(DOMAIN.transferAmount, [big(v.inputs.s), big(v.inputs.sigma)]);
			expect(hex(modR(big(v.inputs.v_transfer) + mask))).toBe(v.output);
		}
		for (const v of balance.vectors) {
			const mask = hasher.hash(DOMAIN.encryptedBalance, [big(v.inputs.vk), big(v.inputs.sigma)]);
			expect(hex(modR(big(v.inputs.v_new) + mask))).toBe(v.output);
		}
	});

	it("compresses Stellar addresses into the field", () => {
		for (const v of address.vectors) {
			expect(hex(hasher.addressToField(v.inputs.strkey))).toBe(v.output);
		}
	});

	it("encodes points flat and back", () => {
		const point = mul(H, 12345n);
		expect(pointOf(pointBytes(point)).equals(point)).toBe(true);
		expect(pointBytes(mul(H, 0n))).toEqual(new Uint8Array(64));
	});
});
