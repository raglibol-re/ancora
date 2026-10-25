import styles from "./BrandMark.module.css";

type BrandMarkProps = {
	size?: number;
	withWordmark?: boolean;
};

/** The ancora mark (from public/brand) with an optional lowercase wordmark. */
export function BrandMark({ size = 32, withWordmark = true }: BrandMarkProps) {
	return (
		<span className={styles.brand}>
			<img src="/brand/mark.svg" width={size} height={size} alt={withWordmark ? "" : "ancora"} />
			{withWordmark && <span className={styles.wordmark}>ancora</span>}
		</span>
	);
}
