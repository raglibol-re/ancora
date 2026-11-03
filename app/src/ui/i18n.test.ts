import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { de } from "./messages/de.ts";

// Every text the code passes to t() or msg() as a literal has a German entry, and placeholders
// match.

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sources(path);
		return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
	});
}

/** `t("…")`, `t('…')`, `msg("…")`: the text's first argument as written, either quote. */
const CALL = /\b(?:t|msg)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const withoutEscapes = (text: string) => text.replace(/\\(.)/g, "$1");

function usedTexts(): Set<string> {
	const texts = new Set<string>();
	for (const file of sources("src")) {
		for (const match of readFileSync(file, "utf8").matchAll(CALL)) {
			texts.add(withoutEscapes(match[1] ?? match[2] ?? ""));
		}
	}
	return texts;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the German catalog", () => {
	it("has every text the screens use", () => {
		const missing = [...usedTexts()].filter((text) => !(text in de));
		expect(missing).toEqual([]);
	});

	it("keeps the placeholders of each text", () => {
		for (const [english, german] of Object.entries(de)) {
			expect(placeholders(german), english).toEqual(placeholders(english));
		}
	});
});
