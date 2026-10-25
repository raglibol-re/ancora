import { Link } from "react-router";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SampleBanner.module.css";

/** Always visible while sample data is shown, so nothing simulated passes as real. */
export function SampleBanner() {
	const { dataSource, me } = useWorkspace();
	if (dataSource.kind !== "sample") return null;
	return (
		<p className={styles.banner}>
			<span>
				<strong>Simulated:</strong> sample data, not on the Stellar testnet. Viewing as {me.name}.
			</span>
			<Link to="/app/settings#viewing-as">Switch person</Link>
		</p>
	);
}
