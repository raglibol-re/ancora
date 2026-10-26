import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLifeline } from "../lifeline/useLifeline.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ProtectionBanner.module.css";

const REMIND_AGAIN_MS = 7 * 86_400_000;

/**
 * The onboarding nudge for a pass that is still a single point of failure: one passkey and no
 * Lifeline plan. Shown on testnet until either exists, or until dismissed for a week.
 */
export function ProtectionBanner() {
	const { dataSource, preferences, updatePreferences } = useWorkspace();
	const identity = dataSource.identity;
	const { overview } = useLifeline();
	const [passkeys, setPasskeys] = useState<number | null>(null);

	useEffect(() => {
		if (!identity) return;
		let cancelled = false;
		void identity.passkeyCount().then((result) => {
			if (!cancelled && result.ok) setPasskeys(result.value);
		});
		return () => {
			cancelled = true;
		};
	}, [identity]);

	if (!identity || overview === null || passkeys === null) return null;
	const protectedByDevice = passkeys > 1;
	const protectedByGuardians = overview.plan !== null;
	if (protectedByDevice || protectedByGuardians) return null;
	const dismissedAt = preferences.protectionReminderDismissedAt;
	if (dismissedAt !== null && Date.now() - dismissedAt < REMIND_AGAIN_MS) return null;

	return (
		<p className={styles.banner}>
			<span>
				<strong>Not protected yet.</strong> This passkey is the only key to your positions. Add a
				second passkey or name guardians.
			</span>
			<Link to="/app/me#lifeline">Protect my pass</Link>
			<button
				type="button"
				className={styles.dismiss}
				onClick={() => updatePreferences({ protectionReminderDismissedAt: Date.now() })}
			>
				Remind me in a week
			</button>
		</p>
	);
}
