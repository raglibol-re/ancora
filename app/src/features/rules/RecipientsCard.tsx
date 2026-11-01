import { StrKey } from "@stellar/stellar-sdk";
import { useState } from "react";
import { type OrgAccount, shortAddress } from "../../domain/account.ts";
import type { RecipientRule } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import styles from "./Controls.module.css";
import { useProposeChange } from "./useProposeChange.ts";

const MODES: { value: RecipientRule["mode"]; label: string }[] = [
	{ value: "open", label: "Anyone" },
	{ value: "approve", label: "Others need the strictest approvals" },
	{ value: "only", label: "Only the list" },
];

/** Who the organization pays; saved as one rule change under the usual approvals. */
export function RecipientsCard({ account }: { account: OrgAccount }) {
	const { propose, busy } = useProposeChange(account);
	const current: RecipientRule = account.org.recipients ?? { mode: "open", allowed: [] };
	const [mode, setMode] = useState(current.mode);
	const [allowed, setAllowed] = useState<string[]>([...current.allowed]);
	const [extra, setExtra] = useState("");
	const [error, setError] = useState<string | null>(null);
	const saved = account.payees.filter((p) => p.saved);
	const nameOf = (address: string) =>
		account.payees.find((p) => p.account === address)?.name ?? shortAddress(address);
	const candidates = [...new Set([...saved.map((p) => p.account), ...allowed])];

	const toggle = (address: string) =>
		setAllowed(
			allowed.includes(address) ? allowed.filter((a) => a !== address) : [...allowed, address],
		);

	const addExtra = () => {
		const address = extra.trim();
		const valid =
			!account.onchain ||
			StrKey.isValidEd25519PublicKey(address) ||
			StrKey.isValidContract(address);
		if (!address || !valid) {
			setError("Enter a Stellar address (starts with G or C).");
			return;
		}
		setError(null);
		if (!allowed.includes(address)) setAllowed([...allowed, address]);
		setExtra("");
	};

	const save = () => propose({ type: "setRecipients", rule: { mode, allowed } });

	return (
		<Card title="Who you pay">
			<p className={styles.muted}>
				Keep payments to known recipients. Tick saved recipients from the address book or add an
				address; the list and the setting change together, as one rule change.
			</p>
			<Segmented<RecipientRule["mode"]>
				label="Recipients"
				value={mode}
				onChange={setMode}
				options={MODES}
			/>
			{mode !== "open" && (
				<>
					{candidates.length === 0 ? (
						<p className={styles.muted}>No saved recipients yet; add an address below.</p>
					) : (
						<ul className={styles.list}>
							{candidates.map((address) => (
								<li key={address} className={styles.item}>
									<label className={styles.check}>
										<input
											type="checkbox"
											checked={allowed.includes(address)}
											onChange={() => toggle(address)}
										/>
										{nameOf(address)}
									</label>
								</li>
							))}
						</ul>
					)}
					<div className={styles.row}>
						<Field label="Add an address" htmlFor="allow-address" error={error}>
							<input
								id="allow-address"
								className={controlClass}
								placeholder="G… or C…"
								spellCheck={false}
								value={extra}
								onChange={(e) => setExtra(e.target.value)}
							/>
						</Field>
					</div>
					<button type="button" className={buttonClass("secondary")} onClick={addExtra}>
						Add to the list
					</button>
				</>
			)}
			<button type="button" className={buttonClass()} disabled={busy} onClick={save}>
				Save who you pay
			</button>
		</Card>
	);
}
