import type { Asset } from "../../domain/rules/model.ts";
import styles from "./TokenBadge.module.css";

/** A round currency mark for a stablecoin: € for euro assets, $ for dollar assets. */
export function TokenBadge({ asset, size = "md" }: { asset: Asset; size?: "md" | "lg" }) {
	const glyph = asset.currency === "EUR" ? "€" : "$";
	return (
		<span
			className={`${styles.badge} ${styles[size]} ${asset.currency === "EUR" ? styles.eur : styles.usd}`}
			aria-hidden="true"
		>
			{glyph}
		</span>
	);
}

/** "Euro stablecoin" / "US dollar stablecoin", with the issuer when the symbol says so. */
export function describeAsset(asset: Asset): string {
	const currency = asset.currency === "EUR" ? "Euro" : "US dollar";
	if (asset.symbol === "BlendUSDC") return `${currency} · Blend test USDC`;
	if (asset.symbol === "USDC" || asset.symbol === "EURC")
		return `${currency} · Circle ${asset.symbol}`;
	return `${currency} stablecoin`;
}
