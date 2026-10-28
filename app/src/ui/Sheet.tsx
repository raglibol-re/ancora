import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from "react";
import styles from "./Sheet.module.css";
import { WorkingInline } from "./WorkingInline.tsx";

type SheetProps = {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
};

/**
 * Modal sheet on the native <dialog>: focus trapping, Escape and inert background come from
 * the browser; a visible close button and a tap on the backdrop close it too (phones have no
 * Escape key). Bottom sheet on phones, centered dialog on larger screens.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	// Set while the sheet closes because its parent said so (`open` became false): that close
	// must not be reported back as the person closing it. Otherwise a sheet stepping aside for
	// another one (an account's "Add money") made its parent forget it and unmount both.
	const closingFromProp = useRef(false);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) {
			closingFromProp.current = true;
			dialog.close();
		}
	}, [open]);

	// Closing through the dialog itself (button, Escape, backdrop) fires `close`, which calls onClose.
	const close = () => ref.current?.close();
	const onDialogClose = () => {
		if (closingFromProp.current) {
			closingFromProp.current = false;
			return;
		}
		onClose();
	};

	const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
		// Only the dialog element itself receives backdrop clicks; children (including a wallet
		// picker mounted inside) never close the sheet by accident.
		if (event.target !== event.currentTarget) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const inside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!inside) close();
	};

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes a modal dialog natively.
		<dialog
			ref={ref}
			className={styles.sheet}
			onClose={onDialogClose}
			onClick={onBackdropClick}
			aria-labelledby={titleId}
		>
			<div className={styles.header}>
				<h2 id={titleId} className={styles.title}>
					{title}
				</h2>
				<button type="button" className={styles.close} onClick={close} aria-label="Close">
					<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
						<path
							d="M5 5l10 10M15 5L5 15"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							fill="none"
						/>
					</svg>
				</button>
			</div>
			{/* Every sheet shows what runs in the background; the shell's bar is hidden behind it. */}
			<WorkingInline />
			{children}
		</dialog>
	);
}
