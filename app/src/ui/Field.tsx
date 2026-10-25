import type { ReactNode } from "react";
import styles from "./Field.module.css";

type FieldProps = {
	label: string;
	htmlFor: string;
	hint?: ReactNode;
	error?: string | null;
	children: ReactNode;
};

/** Label, control, hint and error in one accessible block. Style inputs via the `.control` class. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
	return (
		<div className={styles.field}>
			<label htmlFor={htmlFor} className={styles.label}>
				{label}
			</label>
			{children}
			{hint && !error && <p className={styles.hint}>{hint}</p>}
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

export const controlClass = styles.control;
