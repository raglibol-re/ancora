import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { canEditProfile, type OrgAccount } from "../../domain/account.ts";
import type { RegistryNameStatus } from "../../domain/dataSource.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SettingsPage.module.css";

const NAME = /^[a-z0-9][a-z0-9-]{1,31}$/;

/**
 * A name for the treasury on the Stellar Registry, so people can find and verify the
 * organization's contract by name instead of by address. The highest role registers it with
 * their pass; the registry records that pass as the name's owner.
 */
export function RegistryNameCard({ account }: { account: OrgAccount }) {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const support = dataSource.registryNames;
	const [status, setStatus] = useState<RegistryNameStatus | null>(null);
	const [name, setName] = useState("");
	const [free, setFree] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const mayEdit = canEditProfile(account.org, me.id);
	// Only the latest load may publish its result.
	const latest = useRef(0);

	const load = useCallback(() => {
		if (!support) return;
		const request = ++latest.current;
		void support.current(account.org.id).then((result) => {
			if (request === latest.current && result.ok) setStatus(result.value);
		});
	}, [support, account.org.id]);

	useEffect(() => {
		load();
		return () => {
			latest.current += 1;
		};
	}, [load]);

	if (!support) return null;
	const channel = support.channel();

	const check = async (event: FormEvent) => {
		event.preventDefault();
		if (!NAME.test(name)) {
			setError("Use 2 to 32 lowercase letters, digits or dashes, like tejo-rowing-club.");
			return;
		}
		setError(null);
		const result = await run(() => support.isFree(name));
		if (result?.ok) setFree(result.value);
	};

	const register = async () => {
		const result = await run(() => support.register(account.org.id, me.id, name), {
			signature: { kind: "passkey", title: `Register ${account.org.name} as ${name}` },
			success: `Registered. ${account.org.name} is now "${name}" on the Stellar Registry.`,
		});
		if (result?.ok) {
			setName("");
			setFree(null);
			load();
		}
	};

	return (
		<Card
			title="Name on the Stellar Registry"
			action={dataSource.kind === "sample" ? <SimulatedTag /> : null}
		>
			<p className={styles.muted}>
				The Stellar Registry is a public, on-chain directory of contracts by name. A name lets
				people find and verify this organization's treasury contract without copying an address.
				{channel ? ` Names go into the registry's open channel (${channel}).` : ""}
			</p>
			{status?.name ? (
				<dl className={styles.facts}>
					<dt>Registered as</dt>
					<dd>
						<strong>{status.name}</strong>
						{status.verified ? " · points to this contract" : " · not found on the registry"}
					</dd>
				</dl>
			) : (
				<p className={styles.muted}>No name yet.</p>
			)}
			{mayEdit ? (
				<form className={styles.form} onSubmit={check}>
					<Field
						label={status?.name ? "Register another name" : "Name"}
						htmlFor="registry-name"
						hint="Lowercase letters, digits and dashes. Registered by your pass, which the registry records as the owner."
						error={error}
					>
						<input
							id="registry-name"
							className={controlClass}
							value={name}
							placeholder="tejo-rowing-club"
							spellCheck={false}
							autoComplete="off"
							onChange={(e) => {
								setName(e.target.value.trim().toLowerCase());
								setFree(null);
							}}
						/>
					</Field>
					{free === true ? (
						<div className={styles.actions}>
							<span className={styles.muted}>“{name}” is free.</span>
							<button type="button" className={buttonClass()} disabled={busy} onClick={register}>
								Register with my passkey
							</button>
						</div>
					) : (
						<div className={styles.actions}>
							{free === false && (
								<span className={styles.warn}>“{name}” is already taken on the registry.</span>
							)}
							<button type="submit" className={buttonClass("secondary")} disabled={busy || !name}>
								Check availability
							</button>
						</div>
					)}
				</form>
			) : (
				<p className={styles.muted}>Only the organization's highest role registers a name.</p>
			)}
		</Card>
	);
}
