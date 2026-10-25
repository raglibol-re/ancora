import type { ReactNode } from "react";
import styles from "./Page.module.css";

type PageProps = {
	title: string;
	lead?: ReactNode;
	children: ReactNode;
};

/** Standard screen layout: heading, optional lead text, stacked content. */
export function Page({ title, lead, children }: PageProps) {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1>{title}</h1>
				{lead && <p className={styles.lead}>{lead}</p>}
			</header>
			{children}
		</div>
	);
}
