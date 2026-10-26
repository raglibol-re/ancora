import { usePendingCommand } from "../features/workspace/pendingCommands.ts";
import styles from "./WorkingBar.module.css";

/**
 * A thin moving line under the top bar and a short status while anything runs in the
 * background: a passkey prompt, a wallet signing, a transaction on its way to Stellar. Appears
 * after a moment so instant commands don't flash it; with reduced motion the line glows.
 */
export function WorkingBar() {
	const label = usePendingCommand();
	return (
		<div className={`${styles.bar} ${label ? styles.active : ""}`} role="status" aria-live="polite">
			<span className={styles.line} aria-hidden="true" />
			{label && (
				<span className={styles.status}>
					<span className={styles.dot} aria-hidden="true" />
					{label}
				</span>
			)}
		</div>
	);
}
