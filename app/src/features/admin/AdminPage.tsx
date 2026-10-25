import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SAMPLE_STORAGE_KEY } from "../../adapters/sample/sampleDataSource.ts";
import { BrandMark } from "../../ui/BrandMark.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { browserStorage } from "../workspace/preferences.ts";
import styles from "./AdminPage.module.css";
import { AdminError, type AdminHealth, fetchAdminHealth } from "./adminApi.ts";
import { DemoModeCard } from "./DemoModeCard.tsx";
import { HealthPanel } from "./HealthPanel.tsx";
import { RecentErrorsCard } from "./RecentErrorsCard.tsx";

const SESSION_KEY = "ancora.admin";

function storedPassphrase(): string {
	try {
		return sessionStorage.getItem(SESSION_KEY) ?? "";
	} catch {
		return "";
	}
}

function storePassphrase(value: string): void {
	try {
		sessionStorage.setItem(SESSION_KEY, value);
	} catch {
		// Blocked storage: the operator types the passphrase again after a reload.
	}
}

/**
 * Operator tool for the hackathon demo (testnet only), behind the ADMIN_PASSPHRASE env var.
 * The operator key pays fees and sends test money; it is not a signer on any organization
 * account and can neither move org funds nor change org rules.
 */
export function AdminPage() {
	const [passphrase, setPassphrase] = useState(storedPassphrase);
	const [health, setHealth] = useState<AdminHealth | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const startedWithStoredPassphrase = useRef(false);

	const load = useCallback(async (candidate: string) => {
		setBusy(true);
		try {
			const result = await fetchAdminHealth(candidate);
			storePassphrase(candidate);
			setPassphrase(candidate);
			setHealth(result);
			setError(null);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Something went wrong.");
			if (failure instanceof AdminError && failure.status === 401) setHealth(null);
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		if (passphrase && !startedWithStoredPassphrase.current) {
			startedWithStoredPassphrase.current = true;
			void load(passphrase);
		}
	}, [passphrase, load]);

	if (!health) return <PassphraseGate busy={busy} error={error} onSubmit={load} />;

	return (
		<Page
			title="Demo admin"
			lead="Operator tools for the testnet demo. Not an end-user feature. The operator key is not a signer on any organization account."
		>
			<DemoModeCard
				passphrase={passphrase}
				demo={health.demo}
				onChange={(demo) => setHealth({ ...health, demo })}
			/>
			<HealthPanel
				health={health}
				busy={busy}
				passphrase={passphrase}
				onRefresh={() => load(passphrase)}
			/>
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
			<RecentErrorsCard />
			<Card title="Sample data in this browser">
				<p>
					Puts the sample organizations back to their starting state. Testnet accounts are
					untouched.
				</p>
				<button
					type="button"
					className={buttonClass("secondary")}
					onClick={() => {
						browserStorage()?.removeItem(SAMPLE_STORAGE_KEY);
						window.location.reload();
					}}
				>
					Reset sample data
				</button>
			</Card>
		</Page>
	);
}

type GateProps = {
	busy: boolean;
	error: string | null;
	onSubmit: (passphrase: string) => void;
};

function PassphraseGate({ busy, error, onSubmit }: GateProps) {
	const [value, setValue] = useState("");
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (value.trim()) onSubmit(value.trim());
	};
	return (
		<main className={styles.gate}>
			<BrandMark size={40} />
			<form className={styles.gateForm} onSubmit={submit}>
				<h1>Demo admin</h1>
				<p>Operator access for the testnet demo. Not for end users.</p>
				<Field label="Operator passphrase" htmlFor="admin-passphrase" error={error}>
					<input
						id="admin-passphrase"
						className={controlClass}
						type="password"
						autoComplete="current-password"
						value={value}
						onChange={(e) => setValue(e.target.value)}
					/>
				</Field>
				<button type="submit" className={buttonClass()} disabled={busy || !value.trim()}>
					{busy ? "Checking…" : "Open"}
				</button>
			</form>
		</main>
	);
}
