import { Link } from "react-router";
import { PlusIcon, ReserveIcon, RulesIcon, SendIcon } from "../../ui/icons.tsx";
import styles from "./QuickActions.module.css";

type QuickActionsProps = {
	onAdd: (() => void) | null;
};

/** The four things people do most, as round buttons under the balance. */
export function QuickActions({ onAdd }: QuickActionsProps) {
	const scrollToReserve = () =>
		document.getElementById("reserve")?.scrollIntoView({ behavior: "smooth", block: "start" });

	return (
		<ul className={styles.row} aria-label="Quick actions">
			<li>
				<Link to="/app/pay" className={styles.action}>
					<span className={`${styles.circle} ${styles.primary}`}>
						<SendIcon />
					</span>
					<span className={styles.label}>Send</span>
				</Link>
			</li>
			<li>
				<button
					type="button"
					className={styles.action}
					onClick={onAdd ?? undefined}
					disabled={!onAdd}
				>
					<span className={styles.circle}>
						<PlusIcon />
					</span>
					<span className={styles.label}>Add</span>
				</button>
			</li>
			<li>
				<button type="button" className={styles.action} onClick={scrollToReserve}>
					<span className={styles.circle}>
						<ReserveIcon />
					</span>
					<span className={styles.label}>Reserve</span>
				</button>
			</li>
			<li>
				<Link to="/app/rules" className={styles.action}>
					<span className={styles.circle}>
						<RulesIcon />
					</span>
					<span className={styles.label}>Rules</span>
				</Link>
			</li>
		</ul>
	);
}
