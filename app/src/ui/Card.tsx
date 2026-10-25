import type { ReactNode } from "react";
import styles from "./Card.module.css";

type CardProps = {
	title?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	tone?: "default" | "deep";
};

export function Card({ title, action, children, tone = "default" }: CardProps) {
	return (
		<section className={`${styles.card} ${tone === "deep" ? styles.deep : ""}`}>
			{(title || action) && (
				<header className={styles.header}>
					{title && <h2 className={styles.title}>{title}</h2>}
					{action}
				</header>
			)}
			{children}
		</section>
	);
}
