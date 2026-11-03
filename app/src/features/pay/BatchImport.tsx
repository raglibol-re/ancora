import { type ChangeEvent, useState } from "react";
import type { Payee } from "../../domain/account.ts";
import { type BatchLineInput, parseBatchCsv } from "../../domain/batchImport.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useNotify } from "../notices/NoticeContext.ts";
import styles from "./BatchImport.module.css";

type Props = {
	payees: readonly Payee[];
	disabled: boolean;
	onImport: (lines: BatchLineInput[]) => void;
};

/** Fills the batch from a spreadsheet export; the lines stay editable before the request. */
export function BatchImport({ payees, disabled, onImport }: Props) {
	const t = useT();
	const notify = useNotify();
	const [error, setError] = useState<string | null>(null);

	const load = async (event: ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		const result = parseBatchCsv(await file.text(), payees);
		// Cleared so choosing the same file again, after fixing it, reads it again.
		input.value = "";
		if (!result.ok) {
			setError(`${file.name}: ${result.error}`);
			return;
		}
		setError(null);
		onImport(result.value);
		notify({
			tone: "success",
			text: t("{count} payments from {file}. Check them, then request the batch.", {
				count: result.value.length,
				file: file.name,
			}),
		});
	};

	return (
		<div className={styles.import}>
			<label className={styles.upload}>
				<span className={styles.label}>{t("Import from a spreadsheet (CSV)")}</span>
				<input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={load} disabled={disabled} />
				<span>
					{t(
						"One payment per row: recipient (address or a saved name), amount, reference. A header row is fine. Amounts with a decimal comma need semicolons between the columns, as European spreadsheets export them.",
					)}
				</span>
			</label>
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
