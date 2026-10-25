import type { CSSProperties } from "react";
import styles from "./Avatar.module.css";
import { initials } from "./format.ts";

type AvatarProps = {
	name: string;
	imageUrl?: string | null;
	size?: "sm" | "md" | "lg" | "xl";
	shape?: "circle" | "square";
};

/** A stable hue per name, so people are told apart at a glance before they add a picture. */
function hueOf(seed: string): number {
	let hash = 0;
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return hash % 360;
}

/** Organization logo (square) or person picture (circle), falling back to initials. */
export function Avatar({ name, imageUrl, size = "md", shape = "square" }: AvatarProps) {
	const className = `${styles.avatar} ${styles[size]} ${styles[shape]}`;
	if (imageUrl) {
		return <img className={className} src={imageUrl} alt="" />;
	}
	const style = shape === "circle" ? ({ "--avatar-hue": hueOf(name) } as CSSProperties) : undefined;
	return (
		<span className={className} style={style} aria-hidden="true">
			{initials(name)}
		</span>
	);
}
