import { LANGUAGES, setLanguage } from "./i18n.ts";
import { Segmented } from "./Segmented.tsx";
import { useLanguage, useT } from "./useLanguage.ts";

/** "EN" and "DE" instead of the full names, where the full names don't fit. */
const SHORT = LANGUAGES.map(({ value }) => ({ value, label: value.toUpperCase() }));

/**
 * English / Deutsch, kept for this browser. `compact` shows the language codes: a phone's
 * landing-page header has no room for the names next to the logo and the button.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
	const t = useT();
	const language = useLanguage();
	return (
		<Segmented
			label={t("Language")}
			options={compact ? SHORT : LANGUAGES}
			value={language}
			onChange={setLanguage}
		/>
	);
}
