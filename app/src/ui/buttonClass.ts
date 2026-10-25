import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary";

/** Class names for anything that should look like a button (<button>, <Link>, <a>). */
export function buttonClass(variant: ButtonVariant = "primary"): string {
	return `${styles.button} ${styles[variant]}`;
}
