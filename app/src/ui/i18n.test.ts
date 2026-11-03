import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_ERROR_MESSAGES } from "../adapters/testnet/mapOrganization.ts";
import { POT_ERROR_MESSAGES } from "../adapters/testnet/pot/potErrors.ts";
import {
	DEAL_ERROR_MESSAGES,
	DEAL_STATUS_LABELS,
	MILESTONE_STATUS_LABELS,
} from "../domain/deals.ts";
import { setLanguage, t } from "./i18n.ts";
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

describe("engine and contract messages", () => {
	it("all have German", () => {
		const tables = [
			CONTRACT_ERROR_MESSAGES,
			DEAL_ERROR_MESSAGES,
			POT_ERROR_MESSAGES,
			DEAL_STATUS_LABELS,
			MILESTONE_STATUS_LABELS,
		];
		const missing = tables.flatMap((table) => Object.values(table)).filter((text) => !(text in de));
		expect(missing).toEqual([]);
	});

	it("translate a failure part by part", () => {
		setLanguage("de");
		expect(t("Couldn't open the pot: The pot is already open.")).toBe(
			"Die Kasse konnte nicht eröffnet werden: Die Kasse ist schon eröffnet.",
		);
		setLanguage("en");
	});
});
