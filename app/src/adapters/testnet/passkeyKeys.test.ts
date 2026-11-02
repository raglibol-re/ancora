import { describe, expect, it } from "vitest";
import { keysFromSecret } from "./passkeyKeys.ts";

describe("keys made from a passkey", () => {
	it("are the same for the same passkey secret, on any device", async () => {
		const secret = new Uint8Array(32).fill(7);
		expect(await keysFromSecret(secret)).toEqual(await keysFromSecret(Uint8Array.from(secret)));
	});

	it("differ between passkeys and between the two keys", async () => {
		const one = await keysFromSecret(new Uint8Array(32).fill(1));
		const two = await keysFromSecret(new Uint8Array(32).fill(2));
		expect(one.privateKey).not.toEqual(two.privateKey);
		expect(one.privateKey).not.toEqual(one.sealSeed);
		expect(one.privateKey).toHaveLength(32);
		expect(one.sealSeed).toHaveLength(32);
	});
});
