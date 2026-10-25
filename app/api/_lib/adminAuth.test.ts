import { describe, expect, it } from "vitest";
import { passphraseMatches, requireAdmin } from "./adminAuth.js";

const request = (passphrase?: string) =>
	new Request("https://ancora.test/api/admin", {
		headers: passphrase ? { "X-Ancora-Admin": passphrase } : {},
	});

describe("passphraseMatches", () => {
	it("accepts the exact passphrase only", () => {
		expect(passphraseMatches("open sesame", "open sesame")).toBe(true);
		expect(passphraseMatches("open sesame ", "open sesame")).toBe(false);
		expect(passphraseMatches("", "open sesame")).toBe(false);
		expect(passphraseMatches(null, "open sesame")).toBe(false);
	});
});

describe("requireAdmin", () => {
	it("refuses with 503 when the passphrase is not configured", () => {
		expect(() => requireAdmin(request("x"), undefined)).toThrow(/not set up/);
	});

	it("refuses with 401 on a wrong or missing passphrase", () => {
		expect(() => requireAdmin(request("nope"), "secret")).toThrow(/Wrong passphrase/);
		expect(() => requireAdmin(request(), "secret")).toThrow(/Wrong passphrase/);
	});

	it("passes with the right passphrase", () => {
		expect(() => requireAdmin(request("secret"), "secret")).not.toThrow();
	});
});
