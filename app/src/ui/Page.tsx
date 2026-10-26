import { type ReactNode, useEffect } from "react";
import styles from "./Page.module.css";

type PageProps = {
	title: string;
	lead?: ReactNode;
	children: ReactNode;
};

/** Standard screen layout: heading, optional lead text, stacked content; names the browser tab. */
export function Page({ title, lead, children }: PageProps) {
	useEffect(() => {
		document.title = `${title} · ancora`;
	}, [title]);
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
