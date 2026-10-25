import styles from "./BrandMark.module.css";

type BrandMarkProps = {
	size?: number;
	withWordmark?: boolean;
};

/**
 * The ancora mark (from public/brand) with an optional lowercase wordmark, built like the
 * lockup: gap = ⅓ of the mark width. Below 40 px the brand rules require the small cut,
 * which is the rounded favicon tile; larger sizes use the master mark.
 */
export function BrandMark({ size = 32, withWordmark = true }: BrandMarkProps) {
	const src = size < 40 ? "/brand/favicon.svg" : "/brand/mark-on-dark.svg";
	return (
		<span className={styles.brand} style={{ gap: size / 3 }}>
			<img src={src} width={size} height={size} alt={withWordmark ? "" : "ancora"} />
			{withWordmark && (
				<span className={styles.wordmark} style={{ fontSize: size * 0.72 }}>
					ancora
				</span>
			)}
		</span>
	);
}
