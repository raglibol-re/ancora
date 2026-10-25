import { Link } from "react-router";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./DataSourceBanner.module.css";

/** Always visible in the app, so nobody mistakes sample data or test money for the real thing. */
export function DataSourceBanner() {
	const { dataSource, me, sourceStatus } = useWorkspace();
	if (sourceStatus.fallbackReason) {
		return (
			<p className={styles.banner}>
				<span>
					<strong>Sample data:</strong> {sourceStatus.fallbackReason} Showing sample data instead.
				</span>
				<button type="button" className={styles.retry} onClick={sourceStatus.retry}>
					Retry
				</button>
			</p>
		);
	}
	if (dataSource.kind === "testnet") {
		return (
			<p className={`${styles.banner} ${styles.testnet}`}>
				<span>
					<strong>Stellar testnet:</strong> real transactions with test money; the rules run in your
					organization's contract. Signed in as {me.name}.
				</span>
				<Link to="/app/me#data-source">Change</Link>
			</p>
		);
	}
	return (
		<p className={styles.banner}>
			<span>
				<strong>Simulated:</strong> sample data, not on the Stellar testnet. Viewing as {me.name}.
			</span>
			<Link to="/app/me#viewing-as">Switch person</Link>
		</p>
	);
}
