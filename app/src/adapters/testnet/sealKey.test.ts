import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { describe, expect, it } from "vitest";
import vector from "../../../../contracts/test-vectors/ml-dsa-44.json";

const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

// The device signs seals with the same library settings that produced the vector the seal
// verifier contract accepts (ML-DSA-44, empty context, 32-byte payload).
describe("seal key signatures", () => {
	it("match the verifier contract's test vector", () => {
		expect(
			ml_dsa44.verify(bytes(vector.signature), bytes(vector.payload), bytes(vector.publicKey)),
		).toBe(true);
	});

	it("come from a key derived from a 32-byte seed, as stored on the device", () => {
		const { publicKey, secretKey } = ml_dsa44.keygen(new Uint8Array(32).fill(7));
		expect(Buffer.from(publicKey).toString("hex")).toBe(vector.publicKey);
		const payload = bytes(vector.payload);
		expect(ml_dsa44.verify(ml_dsa44.sign(payload, secretKey), payload, publicKey)).toBe(true);
	});
});
