import { de } from "./messages/de.ts";

// The words on screen in the person's language. The English text is the key: a phrase without a
// German entry yet shows in English, so screens can be translated one at a time. German addresses
// people with "Sie". The language is kept per browser and starts from the browser's own.

export type Language = "en" | "de";

export const LANGUAGES: readonly { value: Language; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
];

const STORAGE_KEY = "ancora.language";

const catalogs: Record<Language, Readonly<Record<string, string>>> = { en: {}, de };

/** BCP 47 tags for numbers, money and dates in each language. */
export const FORMAT_LOCALE: Record<Language, string> = { en: "en-IE", de: "de-DE" };

function initialLanguage(): Language {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "en" || stored === "de") return stored;
	} catch {
		// No storage (private window): the browser's language decides.
	}
	return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("de")
		? "de"
		: "en";
}

let current: Language = initialLanguage();
if (typeof document !== "undefined") document.documentElement.lang = current;
const listeners = new Set<() => void>();

export const currentLanguage = (): Language => current;

/** Switches the language, remembers it, and tells whoever renders text. */
export function setLanguage(language: Language): void {
	current = language;
	try {
		localStorage.setItem(STORAGE_KEY, language);
	} catch {
		// No storage: the choice lasts until the page is closed.
	}
	if (typeof document !== "undefined") document.documentElement.lang = language;
	for (const listener of listeners) listener();
}

export function onLanguageChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * `text` in the current language, with `{name}` placeholders filled from `values`. Pass the
 * English text as written; it is also the key the German catalog uses.
 */
export function t(text: string, values: Readonly<Record<string, string | number>> = {}): string {
	const translated = catalogs[current][text] ?? text;
	return translated.replace(/\{(\w+)\}/g, (whole, name: string) =>
		name in values ? String(values[name]) : whole,
	);
}

/**
 * Marks a text kept in a constant (a menu label, an option) for translation; `t()` translates it
 * where it is shown. The catalog test finds texts by these two calls.
 */
export const msg = (text: string): string => text;
