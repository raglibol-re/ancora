import { BrandMark } from "../../ui/BrandMark.tsx";
import styles from "./AdminPage.module.css";

/** Operator tool for the hackathon demo. Passphrase gate and actions arrive in task 5. */
export function AdminPage() {
	return (
		<main className={styles.page}>
			<BrandMark />
			<h1>Demo admin</h1>
			<p>Operator tools for the testnet demo. Not available yet.</p>
		</main>
	);
}
