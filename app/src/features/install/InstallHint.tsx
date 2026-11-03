import { buttonClass } from "../../ui/buttonClass.ts";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./InstallHint.module.css";
import { useInstallPrompt } from "./useInstallPrompt.ts";

/** Offers "install the app" where the platform supports it; renders nothing otherwise. */
export function InstallHint() {
	const t = useT();
	const { mode, install } = useInstallPrompt();

	if (mode === "prompt") {
		return (
			<button type="button" className={buttonClass("secondary")} onClick={install}>
				{t("Install the app")}
			</button>
		);
	}
	if (mode === "ios-manual") {
		return (
			<p className={styles.hint}>
				{t("To install: tap")} <strong>{t("Share")}</strong>
				{t(", then")} <strong>{t("Add to Home Screen")}</strong>.
			</p>
		);
	}
	return null;
}
