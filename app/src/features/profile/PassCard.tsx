import { useEffect, useState } from "react";
import type { Person } from "../../domain/account.ts";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { useNotify } from "../notices/NoticeContext.ts";
import styles from "./PassCard.module.css";

type PassCardProps = {
	person: Person;
	/** True when the ID is a real account on Stellar (QR and explorer link make sense). */
	onchain: boolean;
	positions: number;
};

/** "CDPI EZPV DBIA …": the ID in groups of four, readable aloud over the phone. */
const grouped = (id: string) => id.match(/.{1,4}/g)?.join(" ") ?? id;

/**
 * The person's pass: picture, name and ancora ID with a QR code. Organizations invite people by
 * this ID, so it is made to be shown, scanned and copied.
 */
export function PassCard({ person, onchain, positions }: PassCardProps) {
	const notify = useNotify();
	const [qr, setQr] = useState<string | null>(null);

	useEffect(() => {
		if (!onchain) return;
		let cancelled = false;
		// The QR library loads only for people who open their pass.
		void import("qrcode")
			.then(({ toDataURL }) =>
				toDataURL(person.id, {
					margin: 1,
					width: 176,
					errorCorrectionLevel: "M",
					color: { dark: "#0b1730", light: "#ffffff" },
				}),
			)
			.then((url) => {
				if (!cancelled) setQr(url);
			})
			.catch(() => setQr(null));
		return () => {
			cancelled = true;
		};
	}, [person.id, onchain]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(person.id);
			notify({ tone: "success", text: "Your ancora ID is copied. Share it to get invited." });
		} catch {
			notify({ tone: "error", text: "Couldn't copy. Select the ID and copy it by hand." });
		}
	};

	return (
		<section className={styles.pass} aria-label="Your ancora pass">
			<div className={styles.identity}>
				<Avatar name={person.name} imageUrl={person.avatarUrl} size="xl" shape="circle" />
				<div className={styles.who}>
					<span className={styles.eyebrow}>ancora pass</span>
					<h2 className={styles.name}>{person.name}</h2>
					<span className={styles.kind}>
						{onchain ? "Account on Stellar, secured by your passkey" : "Sample person"}
					</span>
				</div>
			</div>

			<div className={styles.idBlock}>
				<span className={styles.eyebrow}>ancora ID</span>
				<code className={styles.id}>{grouped(person.id)}</code>
				<div className={styles.actions}>
					<button type="button" className={buttonClass("secondary")} onClick={copy}>
						Copy ID
					</button>
					{onchain && <ExplorerLink target={person.id}>View on Stellar</ExplorerLink>}
				</div>
			</div>

			{onchain && (
				<div className={styles.qr}>
					{qr ? (
						<img src={qr} width={176} height={176} alt={`QR code of the ancora ID ${person.id}`} />
					) : (
						<span className={styles.qrPlaceholder} />
					)}
					<span className={styles.qrHint}>Scan to invite</span>
				</div>
			)}

			<dl className={styles.stats}>
				<div>
					<dt>Positions</dt>
					<dd>{positions}</dd>
				</div>
				<div>
					<dt>Login</dt>
					<dd>{onchain ? "Passkey" : "Simulated"}</dd>
				</div>
				<div>
					<dt>Network</dt>
					<dd>{onchain ? "Stellar testnet" : "Sample data"}</dd>
				</div>
			</dl>
		</section>
	);
}
