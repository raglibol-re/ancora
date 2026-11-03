import { useEffect, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useProposeChange } from "../rules/useProposeChange.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./SettingsPage.module.css";

/**
 * The quantum-safe security seal: large payments sealed with an ML-DSA key held on the
 * approving device, checked by the organization's contract. Turned on per organization.
 */
export function SealCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const { dataSource, me, personName } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { run } = useCommand();
	const support = dataSource.continuity;
	const [onDevice, setOnDevice] = useState<string | null>(null);

	useEffect(() => {
		if (!support) return;
		let current = true;
		void support.deviceSealKey(me.id).then((key) => {
			if (current) setOnDevice(key);
		});
		return () => {
			current = false;
		};
	}, [support, me.id]);

	if (!support || !account.onchain?.continuity) return null;
	const { org } = account;
	const required = Boolean(org.sealVerifier);
	const mine = org.members.find((m) => m.personId === me.id);
	const holders = org.members.filter((m) => m.hasSealKey);

	const createKey = async () => {
		const result = await run(() => support.createSealKey(org.id, me.id), {
			signature: { kind: "passkey", title: t("Register my quantum-safe seal key") },
			success: t("Your seal key is on this device and registered with the organization."),
		});
		if (result?.ok) setOnDevice(await support.deviceSealKey(me.id));
	};

	return (
		<Card title={t("Security seal")}>
			<p className={styles.muted}>
				{t(
					"Payments above the seal threshold need an extra seal. With quantum-safe seals it is signed by an ML-DSA key (FIPS 204) that stays on the approving device, and the organization checks it before the money moves; a passkey alone no longer seals.",
				)}
			</p>
			<dl className={styles.facts}>
				<div>
					<dt>{t("Seals")}</dt>
					<dd>{required ? t("Quantum-safe keys required") : "Passkey"}</dd>
				</div>
				<div>
					<dt>{t("Your seal key")}</dt>
					<dd>
						{onDevice
							? t("On this device")
							: mine?.hasSealKey
								? t("Registered from another device; seal from there")
								: t("Not created yet")}
					</dd>
				</div>
				<div>
					<dt>{t("Members with a key")}</dt>
					<dd>
						{holders.length === 0
							? t("None yet")
							: holders.map((m) => personName(m.personId)).join(", ")}
					</dd>
				</div>
			</dl>
			<div className={styles.actions}>
				{!onDevice && (
					<button type="button" className={buttonClass()} onClick={createKey}>
						{t("Create my seal key on this device")}
					</button>
				)}
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy}
					onClick={() =>
						propose({ type: "setSealVerifier", verifier: required ? null : support.verifier() })
					}
				>
					{required ? t("Go back to passkey seals") : t("Require quantum-safe seals")}
				</button>
			</div>
		</Card>
	);
}
