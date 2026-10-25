import { useState } from "react";
import { clearRecentErrors, readRecentErrors } from "../../adapters/local/recentErrors.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { browserStorage } from "../workspace/preferences.ts";
import styles from "./HealthPanel.module.css";

/** Failed commands recorded in this browser, newest first. */
export function RecentErrorsCard() {
	const [errors, setErrors] = useState(() => readRecentErrors(browserStorage()));
	return (
		<Card title="Recent errors in this browser">
			{errors.length === 0 ? (
				<p className={styles.muted}>No failed actions recorded.</p>
			) : (
				<>
					<ul className={styles.contracts}>
						{errors.map((entry) => (
							<li key={`${entry.at}-${entry.message}`} className={styles.errorRow}>
								<span className={styles.muted}>{formatDateTime(entry.at)}</span>
								<span className={styles.muted}>{entry.where}</span>
								<span>{entry.message}</span>
							</li>
						))}
					</ul>
					<button
						type="button"
						className={buttonClass("secondary")}
						onClick={() => {
							clearRecentErrors(browserStorage());
							setErrors([]);
						}}
					>
						Clear
					</button>
				</>
			)}
		</Card>
	);
}
