import { Link } from "react-router";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./DataSourceBanner.module.css";

/** Always visible in the app, so nobody mistakes sample data or test money for the real thing. */
export function DataSourceBanner() {
	const { dataSource, me } = useWorkspace();
	if (dataSource.kind === "testnet") {
		return (
			<p className={`${styles.banner} ${styles.testnet}`}>
				<span>
					<strong>Stellar testnet:</strong> real transactions with test money. Approval rules run in
					the app until they move on-chain. Viewing as {me.name}.
				</span>
				<Link to="/app/settings#data-source">Change</Link>
			</p>
		);
	}
	return (
		<p className={styles.banner}>
			<span>
				<strong>Simulated:</strong> sample data, not on the Stellar testnet. Viewing as {me.name}.
			</span>
			<Link to="/app/settings#viewing-as">Switch person</Link>
		</p>
	);
}
