import type { RequestStatus } from "../../domain/rules/requests.ts";
import { statusLabels } from "./describe.ts";
import styles from "./StatusPill.module.css";

export function StatusPill({ status }: { status: RequestStatus }) {
	return <span className={`${styles.pill} ${styles[status]}`}>{statusLabels[status]}</span>;
}
