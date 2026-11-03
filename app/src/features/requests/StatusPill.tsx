import type { RequestStatus } from "../../domain/rules/requests.ts";
import { useT } from "../../ui/useLanguage.ts";
import { statusLabels } from "./describe.ts";
import styles from "./StatusPill.module.css";

export function StatusPill({ status }: { status: RequestStatus }) {
	const t = useT();
	return <span className={`${styles.pill} ${styles[status]}`}>{t(statusLabels[status])}</span>;
}
