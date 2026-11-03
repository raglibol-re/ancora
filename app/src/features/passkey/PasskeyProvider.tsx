import { type ReactNode, useCallback, useRef, useState } from "react";
import { buttonClass } from "../../ui/buttonClass.ts";
import { FingerprintIcon, SealIcon } from "../../ui/icons.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { type ConfirmSignature, PasskeyContext, type SignaturePrompt } from "./PasskeyContext.ts";
import styles from "./PasskeyProvider.module.css";

/**
 * Simulated signing prompt, clearly labeled. Task 4 replaces the passkey kind with a real
 * WebAuthn ceremony; task 8 replaces the seal kind with an ML-DSA signature.
 */
export function PasskeyProvider({ children }: { children: ReactNode }) {
	const t = useT();
	const [prompt, setPrompt] = useState<SignaturePrompt | null>(null);
	const resolver = useRef<((confirmed: boolean) => void) | null>(null);

	const confirm = useCallback<ConfirmSignature>(
		(next) =>
			new Promise<boolean>((resolve) => {
				resolver.current = resolve;
				setPrompt(next);
			}),
		[],
	);

	const finish = (confirmed: boolean) => {
		resolver.current?.(confirmed);
		resolver.current = null;
		setPrompt(null);
	};

	const isSeal = prompt?.kind === "seal";

	return (
		<PasskeyContext.Provider value={confirm}>
			{children}
			<Sheet
				open={prompt !== null}
				title={isSeal ? t("Security seal") : t("Confirm with your passkey")}
				onClose={() => finish(false)}
			>
				<div className={styles.body}>
					<span className={styles.icon}>{isSeal ? <SealIcon /> : <FingerprintIcon />}</span>
					<p className={styles.what}>{prompt?.title}</p>
					<p className={styles.how}>
						{isSeal
							? t(
									"Your passkey confirms the seal; organizations that require quantum-safe seals also sign it with the key on this device.",
								)
							: t("Use Face ID, your fingerprint or your device PIN.")}
					</p>
					<SimulatedTag label={t("Simulated signature")} />
				</div>
				<div className={styles.actions}>
					<button type="button" className={buttonClass("secondary")} onClick={() => finish(false)}>
						{t("Cancel")}
					</button>
					<button type="button" className={buttonClass()} onClick={() => finish(true)}>
						{isSeal ? t("Sign with seal") : "Confirm"}
					</button>
				</div>
			</Sheet>
		</PasskeyContext.Provider>
	);
}
