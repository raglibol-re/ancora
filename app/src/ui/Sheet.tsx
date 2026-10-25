import { type ReactNode, useEffect, useRef } from "react";
import styles from "./Sheet.module.css";

type SheetProps = {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
};

/**
 * Modal sheet on the native <dialog>: focus trapping, Escape and inert background come from
 * the browser. Bottom sheet on phones, centered dialog on larger screens.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog ref={ref} className={styles.sheet} onClose={onClose} aria-labelledby="sheet-title">
			<h2 id="sheet-title" className={styles.title}>
				{title}
			</h2>
			{children}
		</dialog>
	);
}
