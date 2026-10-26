import styles from "./DefindexBadge.module.css";

/**
 * Names the protocol behind the Reserve. DeFindex (paltalabs) runs the vaults the organization
 * contract deposits into; the earnings are theirs to report and vary with Blend's lending rate.
 */
export function DefindexBadge({ compact = false }: { compact?: boolean }) {
	return (
		<a
			className={compact ? `${styles.badge} ${styles.compact}` : styles.badge}
			href="https://defindex.io"
			target="_blank"
			rel="noopener noreferrer"
			title="DeFindex vaults on Stellar: how the Reserve earns"
		>
			<span className={styles.mark} aria-hidden="true">
				D
			</span>
			<span>{compact ? "DeFindex" : "Reserve by DeFindex"}</span>
		</a>
	);
}
