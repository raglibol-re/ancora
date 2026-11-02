import { describe, expect, it } from "vitest";
import { BackupCodeError, decodeBackupCode, encodeBackupCode } from "./deviceKeys.ts";

const key = (fill: number) => new Uint8Array(32).fill(fill);

describe("backup codes", () => {
	it("carry both keys, or just one, and give them back", async () => {
		const both = await encodeBackupCode({ privateKey: key(1), sealSeed: key(2) });
		expect(both.startsWith("ancora-keys-1.")).toBe(true);
		expect(await decodeBackupCode(both)).toEqual({ privateKey: key(1), sealSeed: key(2) });
		const sealOnly = await encodeBackupCode({ privateKey: null, sealSeed: key(3) });
		expect(await decodeBackupCode(` ${sealOnly}\n`)).toEqual({
			privateKey: null,
			sealSeed: key(3),
		});
	});

	it("refuse codes that are cut, altered or not ancora's", async () => {
		const code = await encodeBackupCode({ privateKey: key(1), sealSeed: null });
		await expect(decodeBackupCode(code.slice(0, -3))).rejects.toThrow(BackupCodeError);
		const altered = `${code.slice(0, 20)}${code[20] === "A" ? "B" : "A"}${code.slice(21)}`;
		await expect(decodeBackupCode(altered)).rejects.toThrow(BackupCodeError);
		await expect(decodeBackupCode("hello")).rejects.toThrow(BackupCodeError);
	});
});
