import { describe, expect, it } from "vitest";
import { passkeyUserName } from "./passkeyUserName.ts";

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("passkeyUserName", () => {
	it("keeps short names as they are", () => {
		expect(passkeyUserName("Tejo Rowing Club")).toBe("Tejo Rowing Club");
	});

	it("caps long and accented names at 24 bytes without splitting characters", () => {
		const capped = passkeyUserName("Associação Náutica do Tejo e Arredores");
		expect(bytes(capped)).toBeLessThanOrEqual(24);
		expect(capped).toBe("Associação Náutica do");
	});

	it("leaves room for the kit's timestamp and random suffix within WebAuthn's 64-byte id", () => {
		const worstCase = `${passkeyUserName("x".repeat(100))}:1761408000000:0.12345678901234568`;
		expect(bytes(worstCase)).toBeLessThanOrEqual(64);
	});

	it("never returns an empty name", () => {
		expect(passkeyUserName("   ")).toBe("ancora");
	});
});
