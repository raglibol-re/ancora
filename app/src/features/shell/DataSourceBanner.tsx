import { useSyncExternalStore } from "react";
import { Link } from "react-router";
import { useT } from "../../ui/useLanguage.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./DataSourceBanner.module.css";

/** Always visible in the app, so nobody mistakes sample data or test money for the real thing. */
export function DataSourceBanner() {
	const t = useT();
	const { dataSource, me, sourceStatus } = useWorkspace();
	const syncing = useSyncExternalStore(
		dataSource.subscribe,
		() => dataSource.identity?.syncing() ?? false,
	);
	if (sourceStatus.fallbackReason) {
		return (
			<p className={styles.banner}>
				<span>
					<strong>{t("Sample data:")}</strong> {sourceStatus.fallbackReason}{" "}
					{t("Showing sample data instead.")}
				</span>
				<button type="button" className={styles.retry} onClick={sourceStatus.retry}>
					{t("Retry")}
				</button>
			</p>
		);
	}
	if (dataSource.kind === "testnet") {
		return (
			<p className={`${styles.banner} ${styles.testnet}`}>
				<span>
					<strong>{t("Stellar testnet:")}</strong>{" "}
					{t(
						"real transactions with test money; the rules run in your organization's contract. Signed in as {name}.",
						{ name: me.name },
					)}
					{syncing ? ` ${t("Updating from Stellar…")}` : ""}
				</span>
				<Link to="/app/me#data-source">{t("Change")}</Link>
			</p>
		);
	}
	return (
		<p className={styles.banner}>
			<span>
				<strong>{t("Simulated:")}</strong>{" "}
				{t("sample data, not on the Stellar testnet. Viewing as {name}.", { name: me.name })}
			</span>
			<Link to="/app/me#viewing-as">{t("Switch person")}</Link>
		</p>
	);
}
