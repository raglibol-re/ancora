import { describe, expect, it } from "vitest";
import { fitsPrivately, isPrivateNote } from "../../domain/privateNote.ts";
import {
	decryptNote,
	encryptNote,
	newKeyPair,
	newOrganizationKey,
	unwrapKey,
	wrapKey,
} from "./privateCrypto.ts";

describe("private details", () => {
	it("reach a member only through their own key", async () => {
		const organizationKey = newOrganizationKey();
		const ana = newKeyPair();
		const outsider = newKeyPair();
		const wrapped = await wrapKey(organizationKey, ana.publicKey);
		expect(wrapped.length).toBeLessThanOrEqual(160);
		expect(await unwrapKey(wrapped, ana.secretKey)).toEqual(organizationKey);
		await expect(unwrapKey(wrapped, outsider.secretKey)).rejects.toThrow();
	});

	it("encrypt notes that fit on-chain and read back only with the epoch's key", async () => {
		const key = newOrganizationKey();
		const text = "Coach fees, October (Ana and Rui)";
		expect(fitsPrivately(text, 1)).toBe(true);
		const note = await encryptNote(text, key, 1);
		expect(isPrivateNote(note)).toBe(true);
		expect(note.length).toBeLessThanOrEqual(140);
		expect(note).not.toContain("Coach");
		expect(await decryptNote(note, new Map([[1, key]]))).toBe(text);
		expect(await decryptNote(note, new Map([[2, key]]))).toBeNull();
		expect(await decryptNote(note, new Map([[1, newOrganizationKey()]]))).toBeNull();
		const tampered = `${note.slice(0, -2)}AA`;
		expect(await decryptNote(tampered, new Map([[1, key]]))).toBeNull();
	});

	it("know when a note is too long to encrypt into a reference", () => {
		expect(fitsPrivately("x".repeat(70), 1)).toBe(true);
		expect(fitsPrivately("x".repeat(80), 1)).toBe(false);
	});
});
