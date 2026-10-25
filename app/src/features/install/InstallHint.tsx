import { buttonClass } from "../../ui/buttonClass.ts";
import styles from "./InstallHint.module.css";
import { useInstallPrompt } from "./useInstallPrompt.ts";

/** Offers "install the app" where the platform supports it; renders nothing otherwise. */
export function InstallHint() {
	const { mode, install } = useInstallPrompt();

	if (mode === "prompt") {
		return (
			<button type="button" className={buttonClass("secondary")} onClick={install}>
				Install the app
			</button>
		);
	}
	if (mode === "ios-manual") {
		return (
			<p className={styles.hint}>
				To install: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
			</p>
		);
	}
	return null;
}
