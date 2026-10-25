import styles from "./Avatar.module.css";
import { initials } from "./format.ts";

type AvatarProps = {
	name: string;
	imageUrl?: string | null;
	size?: "sm" | "md" | "lg";
	shape?: "circle" | "square";
};

/** Organization logo or person avatar, falling back to initials. */
export function Avatar({ name, imageUrl, size = "md", shape = "square" }: AvatarProps) {
	const className = `${styles.avatar} ${styles[size]} ${styles[shape]}`;
	if (imageUrl) {
		return <img className={className} src={imageUrl} alt="" />;
	}
	return (
		<span className={className} aria-hidden="true">
			{initials(name)}
		</span>
	);
}
