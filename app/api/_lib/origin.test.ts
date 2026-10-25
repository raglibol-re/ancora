import { describe, expect, it } from "vitest";
import { originAllowed } from "./origin.js";

const allowlist = new Set(["https://ancora-gray.vercel.app", "http://localhost:5173"]);

describe("originAllowed", () => {
	it("accepts the site's own host, whichever project URL served the app", () => {
		expect(
			originAllowed(
				"https://ancora-git-main-raglibol.vercel.app",
				"ancora-git-main-raglibol.vercel.app",
				allowlist,
			),
		).toBe(true);
		expect(originAllowed("http://localhost:4173", "localhost:4173", allowlist)).toBe(true);
	});

	it("accepts allowlisted origins even when served elsewhere", () => {
		expect(originAllowed("http://localhost:5173", "ancora-gray.vercel.app", allowlist)).toBe(true);
	});

	it("refuses other sites", () => {
		expect(originAllowed("https://evil.example", "ancora-gray.vercel.app", allowlist)).toBe(false);
		expect(originAllowed("https://evil.example", null, allowlist)).toBe(false);
		expect(originAllowed("not a url", "ancora-gray.vercel.app", allowlist)).toBe(false);
	});

	it("lets requests without an Origin header through to content checks", () => {
		expect(originAllowed(null, "ancora-gray.vercel.app", allowlist)).toBe(true);
	});
});
