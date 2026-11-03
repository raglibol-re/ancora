import { Link } from "react-router";
import { shortAddress } from "../../domain/account.ts";
import { describeTimeLeft } from "../../domain/lifeline.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Lifeline.module.css";
import { useLifeline } from "./useLifeline.ts";

/** Shown everywhere in the app while someone claims to hold my new pass: the cancel window. */
export function ClaimBanner() {
	const t = useT();
	const { dataSource, me } = useWorkspace();
	const { overview, reload } = useLifeline();
	const { run, busy } = useCommand();
	const claim = overview?.claim;
	if (!claim) return null;

	const cancel = async () => {
		const result = await run(() => dataSource.lifeline.cancelClaim(me.id), {
			success: t("The claim is cancelled. Your pass stays as it is."),
		});
		if (result?.ok) reload();
	};

	return (
		<p className={styles.banner} role="alert">
			<span>
				<strong>{t("Recovery of your pass started")}</strong> {t("for new pass")}{" "}
				{shortAddress(claim.successor)}
				{t(". It can finish")} {describeTimeLeft(claim.readyAt - Date.now())}
				{t(". Not you?")}
			</span>
			<button type="button" className={styles.bannerButton} disabled={busy} onClick={cancel}>
				{t("Cancel it")}
			</button>
			<Link to="/app/me#lifeline">{t("Details")}</Link>
		</p>
	);
}
