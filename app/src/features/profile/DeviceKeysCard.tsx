import { type FormEvent, useState } from "react";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useNotify } from "../notices/NoticeContext.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ProfilePage.module.css";

/**
 * The keys that live only on this device (private details, quantum-safe seal): a backup code
 * to keep somewhere safe, and the way back on a new device.
 */
export function DeviceKeysCard() {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const notify = useNotify();
	const support = dataSource.deviceKeys;
	const [code, setCode] = useState<string | null>(null);
	const [input, setInput] = useState("");
	if (!support) return null;

	const show = async () => {
		const result = await run(() => support.backupCode(me.id));
		if (!result?.ok) return;
		if (result.value === null) {
			notify({ tone: "info", text: "There are no keys on this device yet." });
			return;
		}
		setCode(result.value);
	};

	const copy = async () => {
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code);
			notify({ tone: "success", text: "Backup code copied. Keep it like a password." });
		} catch {
			notify({ tone: "error", text: "Couldn't copy; select the code and copy it by hand." });
		}
	};

	const restore = async (event: FormEvent) => {
		event.preventDefault();
		const result = await run(() => support.restore(me.id, input), {
			success: (restored) => describeRestored(restored) || "Restored.",
		});
		if (result?.ok) setInput("");
	};

	const restoreWithPasskey = async () => {
		const result = await run(() => support.restoreWithPasskey(me.id), {
			signature: { kind: "passkey", title: "Bring back your keys with your passkey" },
		});
		if (!result?.ok) return;
		const restored = result.value;
		notify(
			restored === null
				? {
						tone: "info",
						text: "This passkey or browser can't make keys. Use your backup code instead.",
					}
				: {
						tone: describeRestored(restored) ? "success" : "info",
						text:
							describeRestored(restored) ||
							"Your keys weren't made with this passkey (they were set up before, or with another one). Use your backup code instead.",
					},
		);
	};

	return (
		<Card title="Keys on this device">
			<p className={styles.muted}>
				Your key for private details and your quantum-safe seal key live only in this browser. Where
				your passkey supports it, they are made from your passkey, so a device your passkey syncs to
				gets them back with it. A backup code works everywhere. It can't move money (that always
				needs your passkey), but it reads your organizations' private details: keep it like a
				password.
			</p>
			<button
				type="button"
				className={buttonClass("secondary")}
				disabled={busy}
				onClick={restoreWithPasskey}
			>
				Bring back with my passkey
			</button>
			{code ? (
				<div className={styles.form}>
					<code className={styles.code}>{code}</code>
					<button type="button" className={buttonClass("secondary")} onClick={copy}>
						Copy backup code
					</button>
				</div>
			) : (
				<button type="button" className={buttonClass("secondary")} disabled={busy} onClick={show}>
					Show backup code
				</button>
			)}
			<form className={styles.form} onSubmit={restore}>
				<Field label="Restore from a backup code" htmlFor="backup-code">
					<input
						id="backup-code"
						className={controlClass}
						placeholder="ancora-keys-1.…"
						spellCheck={false}
						autoComplete="off"
						value={input}
						onChange={(e) => setInput(e.target.value)}
					/>
				</Field>
				<button type="submit" className={buttonClass()} disabled={busy || !input.trim()}>
					Restore keys
				</button>
			</form>
		</Card>
	);
}

/** What came back, in plain words; empty when nothing did. */
function describeRestored(restored: { privateKey: boolean; sealKey: boolean }): string {
	return [
		restored.privateKey ? "Private details read again on this device." : null,
		restored.sealKey ? "Quantum-safe seals sign again on this device." : null,
	]
		.filter(Boolean)
		.join(" ");
}
