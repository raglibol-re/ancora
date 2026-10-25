import { SAMPLE_DEFAULT_PERSON } from "../../adapters/sample/seedWorkspace.ts";

export type ThemePreference = "system" | "light" | "dark";

/** Per-browser conveniences only; nothing here affects money or rules. */
export type Preferences = {
	theme: ThemePreference;
	expertMode: boolean;
	/** Sample mode only: whose eyes the demo is seen through. Replaced by passkey sign-in (task 4). */
	personId: string;
	activeOrgId: string | null;
};

const KEY = "ancora.prefs.v1";

export const defaultPreferences: Preferences = {
	theme: "system",
	expertMode: false,
	personId: SAMPLE_DEFAULT_PERSON,
	activeOrgId: null,
};

/** localStorage, or null where the browser blocks it (some private modes, sandboxed previews). */
export function browserStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

export function loadPreferences(storage: Storage | null): Preferences {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? "null");
		return typeof parsed === "object" && parsed !== null
			? { ...defaultPreferences, ...(parsed as Partial<Preferences>) }
			: defaultPreferences;
	} catch {
		// Corrupt entry: defaults are the defined fallback.
		return defaultPreferences;
	}
}

export function savePreferences(storage: Storage | null, preferences: Preferences): void {
	try {
		storage?.setItem(KEY, JSON.stringify(preferences));
	} catch {
		// Blocked or full storage: preferences then last for this tab only.
	}
}
