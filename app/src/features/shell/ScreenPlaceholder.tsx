import styles from "./ScreenPlaceholder.module.css";

/** Stand-in for screens that arrive in task 2 (see docs/ROADMAP.md). */
export function ScreenPlaceholder({ title }: { title: string }) {
	return (
		<section className={styles.screen}>
			<h1>{title}</h1>
			<p className={styles.note}>This screen is being built.</p>
		</section>
	);
}
