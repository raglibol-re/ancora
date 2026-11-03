import styles from "./DefindexBadge.module.css";
import { useT } from "./useLanguage.ts";

/**
 * Names the protocol behind the Reserve. DeFindex (paltalabs) runs the vaults the organization
 * contract deposits into; the earnings are theirs to report and vary with Blend's lending rate.
 */
export function DefindexBadge({ compact = false }: { compact?: boolean }) {
	const t = useT();
	return (
		<a
			className={compact ? `${styles.badge} ${styles.compact}` : styles.badge}
			href="https://defindex.io"
			target="_blank"
			rel="noopener noreferrer"
			title={t("DeFindex vaults on Stellar: how the Reserve earns")}
		>
			<span className={styles.mark} aria-hidden="true">
				D
			</span>
			<span>{compact ? "DeFindex" : t("Reserve by DeFindex")}</span>
		</a>
	);
}
