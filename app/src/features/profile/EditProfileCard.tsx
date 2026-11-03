import { type ChangeEvent, type FormEvent, useState } from "react";
import type { IdentitySupport } from "../../domain/dataSource.ts";
import { err, ok } from "../../domain/result.ts";
import { ruleError } from "../../domain/rules/model.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { resizeLogo, validateLogoFile } from "../settings/logo.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ProfilePage.module.css";

/** Name and picture, saved to the person's on-chain profile in one passkey signature. */
export function EditProfileCard({ identity }: { identity: IdentitySupport }) {
	const t = useT();
	const { me } = useWorkspace();
	const { run, busy } = useCommand();
	const [name, setName] = useState(me.name);
	const [picture, setPicture] = useState<{ preview: string; blob: Blob } | "remove" | null>(null);
	const [pictureError, setPictureError] = useState<string | null>(null);

	const preview = picture === "remove" ? null : (picture?.preview ?? me.avatarUrl ?? null);
	const changed = name.trim() !== me.name || picture !== null;

	const choosePicture = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		const valid = validateLogoFile(file);
		if (!valid.ok) {
			setPictureError(valid.error);
			return;
		}
		setPictureError(null);
		try {
			const dataUrl = await resizeLogo(file);
			const blob = await (await fetch(dataUrl)).blob();
			setPicture({ preview: dataUrl, blob });
		} catch {
			setPictureError(t("This image couldn't be read. Try another file."));
		}
	};

	const save = (event: FormEvent) => {
		event.preventDefault();
		void run(
			async () => {
				let avatarUrl = me.avatarUrl ?? null;
				if (picture === "remove") avatarUrl = null;
				else if (picture) {
					const uploaded = await identity.uploadAvatar(picture.blob);
					if (!uploaded.ok) return uploaded;
					avatarUrl = uploaded.value;
				}
				const saved = await identity.saveProfile({ name, avatarUrl });
				if (!saved.ok) return err(ruleError(saved.error.code, saved.error.message));
				setPicture(null);
				return ok(undefined);
			},
			{ success: t("Profile saved on Stellar. Every organization sees it.") },
		);
	};

	return (
		<Card title={t("Your profile")}>
			<form className={styles.form} onSubmit={save}>
				<div className={styles.pictureRow}>
					<Avatar name={name || me.name} imageUrl={preview} size="xl" shape="circle" />
					<div className={styles.pictureActions}>
						<label className={buttonClass("secondary")}>
							<input
								type="file"
								accept="image/png,image/jpeg,image/webp"
								onChange={choosePicture}
								disabled={busy}
								className={styles.fileInput}
							/>
							{preview ? t("Change picture") : t("Add picture")}
						</label>
						{preview && (
							<button
								type="button"
								className={styles.linkButton}
								disabled={busy}
								onClick={() => setPicture("remove")}
							>
								{t("Remove picture")}
							</button>
						)}
						<span className={styles.muted}>
							{t("PNG, JPG or WebP. Cropped to a 256×256 square in your browser.")}
						</span>
						{pictureError && (
							<span className={styles.error} role="alert">
								{pictureError}
							</span>
						)}
					</div>
				</div>
				<Field label={t("Your name")} htmlFor="profile-name" hint={t("Up to 64 characters.")}>
					<input
						id="profile-name"
						className={controlClass}
						autoComplete="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</Field>
				<div>
					<button
						type="submit"
						className={buttonClass()}
						disabled={busy || !changed || !name.trim()}
					>
						{busy ? "Saving…" : t("Save profile")}
					</button>
				</div>
			</form>
		</Card>
	);
}
