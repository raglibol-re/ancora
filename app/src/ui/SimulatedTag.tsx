import { msg } from "./i18n.ts";
import styles from "./SimulatedTag.module.css";
import { useT } from "./useLanguage.ts";

/** Marks anything backed by sample data instead of the Stellar testnet (or, relabelled, a preview). */
export function SimulatedTag({
	label = msg("Simulated"),
	title = msg("Sample data, not on the Stellar testnet"),
}: {
	label?: string;
	title?: string;
}) {
	const t = useT();
	return (
		<span className={styles.tag} title={t(title)}>
			{t(label)}
		</span>
	);
}
