import { usePendingCommand } from "../features/workspace/pendingCommands.ts";
import styles from "./WorkingInline.module.css";

/**
 * The working status inside a sheet or form: a turning ring and the step's label while a
 * passkey prompt, a wallet signature or a transaction is in flight. The shell's bar sits under
 * the top bar, which a sheet covers, so the sheet shows its own.
 */
export function WorkingInline() {
	const label = usePendingCommand();
	if (!label) return null;
	return (
		<p className={styles.working} role="status" aria-live="polite">
			<span className={styles.ring} aria-hidden="true" />
			{label}
		</p>
	);
}
