import { LANGUAGES, setLanguage } from "./i18n.ts";
import { Segmented } from "./Segmented.tsx";
import { useLanguage, useT } from "./useLanguage.ts";

/** English / Deutsch, kept for this browser. */
export function LanguageSwitch() {
	const t = useT();
	const language = useLanguage();
	return (
		<Segmented label={t("Language")} options={LANGUAGES} value={language} onChange={setLanguage} />
	);
}
