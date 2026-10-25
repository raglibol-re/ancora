import styles from "./SimulatedTag.module.css";

/** Marks anything backed by sample data instead of the Stellar testnet. */
export function SimulatedTag({ label = "Simulated" }: { label?: string }) {
	return (
		<span className={styles.tag} title="Sample data, not on the Stellar testnet">
			{label}
		</span>
	);
}
