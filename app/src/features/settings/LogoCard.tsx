import type { ChangeEvent } from "react";
import { canEditProfile, type OrgAccount } from "../../domain/account.ts";
import { err, ok } from "../../domain/result.ts";
import { ruleError } from "../../domain/rules/model.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { Card } from "../../ui/Card.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./LogoCard.module.css";
import { resizeLogo, validateLogoFile } from "./logo.ts";

/** Upload the organization's logo; only its highest role may change it. */
export function LogoCard({ account }: { account: OrgAccount }) {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const allowed = canEditProfile(account.org, me.id);

	const upload = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		const valid = validateLogoFile(file);
		await run(
			async () => {
				if (!valid.ok) return err(ruleError("not-allowed", valid.error));
				const dataUrl = await resizeLogo(file).catch(() => null);
				if (!dataUrl) {
					return err(ruleError("not-allowed", "This image couldn't be read. Try another file."));
				}
				const saved = await dataSource.setLogo(account.org.id, me.id, dataUrl);
				return saved.ok ? ok(undefined) : saved;
			},
			{
				signature: { kind: "passkey", title: `Change the logo of ${account.org.name}` },
				success: "Logo updated.",
			},
		);
	};

	return (
		<Card
			title="Organization logo"
			action={dataSource.kind === "sample" ? <SimulatedTag label="Stored in this browser" /> : null}
		>
			<div className={styles.row}>
				<Avatar name={account.org.name} imageUrl={account.logoUrl} size="lg" />
				{allowed ? (
					<label className={styles.upload}>
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onChange={upload}
							disabled={busy}
						/>
						<span>
							PNG, JPG or WebP, up to 5 MB. Resized to 256×256 in your browser
							{dataSource.kind === "testnet" && ", stored with the organization on Stellar"}.
						</span>
					</label>
				) : (
					<p className={styles.hint}>Only the organization's highest role can change the logo.</p>
				)}
			</div>
		</Card>
	);
}
