import styles from "./SimulatedTag.module.css";

/** Marks anything backed by sample data instead of the Stellar testnet (or, relabelled, a preview). */
export function SimulatedTag({
	label = "Simulated",
	title = "Sample data, not on the Stellar testnet",
}: {
	label?: string;
	title?: string;
}) {
	return (
		<span className={styles.tag} title={title}>
			{label}
		</span>
	);
}
