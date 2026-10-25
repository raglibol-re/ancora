import { describe, expect, it } from "vitest";
import { validateLogoFile } from "./logo.ts";

describe("validateLogoFile", () => {
	it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s", (type) => {
		expect(validateLogoFile({ type, size: 1000 }).ok).toBe(true);
	});

	it("rejects SVG because it can carry scripts", () => {
		expect(validateLogoFile({ type: "image/svg+xml", size: 1000 })).toMatchObject({ ok: false });
	});

	it("rejects files over 5 MB", () => {
		expect(validateLogoFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }).ok).toBe(false);
	});
});
