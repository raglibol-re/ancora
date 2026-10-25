import { type FormEvent, useState } from "react";
import type { IdentitySupport } from "../../domain/dataSource.ts";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import styles from "./SignInPage.module.css";

type SignInPageProps = {
	identity: IdentitySupport;
	onUseSampleData: () => void;
};

/** Your passkey is your login. Creating one deploys your account on Stellar; fees are sponsored. */
export function SignInPage({ identity, onUseSampleData }: SignInPageProps) {
	const [name, setName] = useState("");
	const [busy, setBusy] = useState<"create" | "signin" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = async (kind: "create" | "signin") => {
		setBusy(kind);
		setError(null);
		const result =
			kind === "create" ? await identity.createIdentity(name) : await identity.signIn();
		if (!result.ok) setError(result.error.message);
		setBusy(null);
	};

	const create = (event: FormEvent) => {
		event.preventDefault();
		if (name.trim()) void run("create");
	};

	return (
		<main className={styles.page}>
			<BrandMark size={44} />
			<div className={styles.card}>
				<h1>Welcome to ancora</h1>
				<p className={styles.lead}>
					Your passkey is your login. It creates your own account on Stellar, which represents you
					in every organization you join. No seed phrase, no password, fees are sponsored.
				</p>
				<form className={styles.form} onSubmit={create}>
					<Field
						label="Your name"
						htmlFor="identity-name"
						hint="Shown to the organizations you work with."
					>
						<input
							id="identity-name"
							className={controlClass}
							autoComplete="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy !== null || !name.trim()}>
						{busy === "create" ? "Creating your account…" : "Create my passkey"}
					</button>
				</form>
				<div className={styles.divider}>already have one?</div>
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy !== null}
					onClick={() => run("signin")}
				>
					{busy === "signin" ? "Waiting for your passkey…" : "Sign in with my passkey"}
				</button>
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}
				<p className={styles.note}>
					Stellar testnet with test money. Passkeys are tied to this website's domain.
				</p>
				<p className={styles.note}>
					Lost your pass? Create a new one above, then open Your pass → "Recover an old pass": the
					guardians you named confirm the new pass and your positions move over.
				</p>
			</div>
			<button type="button" className={styles.link} onClick={onUseSampleData}>
				Look around with sample data instead
			</button>
		</main>
	);
}
