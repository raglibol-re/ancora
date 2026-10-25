import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { IdentitySupport } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import styles from "./ProfilePage.module.css";

/**
 * The passkeys that can sign for this account. A second one on a security key or another phone
 * means a lost or broken device doesn't lock you out; the browser offers the hardware key, this
 * device or a phone (by QR) when you add it.
 */
export function DevicesSection({ identity }: { identity: IdentitySupport }) {
	const { run, busy } = useCommand();
	const [count, setCount] = useState<number | null>(null);
	const [adding, setAdding] = useState(false);
	const [label, setLabel] = useState("");

	const load = useCallback(() => {
		void identity.passkeyCount().then((result) => {
			if (result.ok) setCount(result.value);
		});
	}, [identity]);

	useEffect(() => {
		load();
	}, [load]);

	const add = async (event: FormEvent) => {
		event.preventDefault();
		const result = await run(() => identity.addPasskey(label.trim() || "Second passkey"), {
			success: "The new passkey can now sign for your account.",
		});
		if (result?.ok) {
			setAdding(false);
			setLabel("");
			load();
		}
	};

	return (
		<div>
			<dt>Devices</dt>
			<dd>
				{count === null ? (
					"Reading your passkeys…"
				) : count > 1 ? (
					<>
						<span className={styles.protected}>{count} passkeys</span> can sign for this account.
					</>
				) : (
					<>
						<span className={styles.warn}>One passkey</span>: if this device is lost, only Lifeline
						can get your positions back. Add a second one.
					</>
				)}
				{adding ? (
					<form className={styles.inlineForm} onSubmit={add}>
						<Field
							label="Name of the new passkey"
							htmlFor="passkey-label"
							hint="Your browser then asks where to create it: a security key, this device, or another phone by QR code."
						>
							<input
								id="passkey-label"
								className={controlClass}
								value={label}
								placeholder="YubiKey, old phone…"
								onChange={(e) => setLabel(e.target.value)}
							/>
						</Field>
						<div className={styles.actions}>
							<button type="submit" className={buttonClass()} disabled={busy}>
								{busy ? "Waiting for the passkey…" : "Create and add"}
							</button>
							<button type="button" className={styles.linkButton} onClick={() => setAdding(false)}>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<div className={styles.actions}>
						<button
							type="button"
							className={buttonClass("secondary")}
							disabled={busy}
							onClick={() => setAdding(true)}
						>
							Add a passkey
						</button>
					</div>
				)}
			</dd>
		</div>
	);
}
