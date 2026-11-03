import { useSyncExternalStore } from "react";
import { currentLanguage, onLanguageChange, t } from "./i18n.ts";

/** The current language; a component that reads it renders again when it changes. */
export function useLanguage() {
	return useSyncExternalStore(onLanguageChange, currentLanguage, currentLanguage);
}

/** `t` for a component, which then renders again in the new language after a switch. */
export function useT(): typeof t {
	useLanguage();
	return t;
}
