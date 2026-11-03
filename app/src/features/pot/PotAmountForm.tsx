import { StrKey } from "@stellar/stellar-sdk";
import { type FormEvent, useId, useState } from "react";
import { type Cents, type Currency, parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import styles from "./Pot.module.css";

type Props = {
	title: string;
	hint: string;
	action: string;
	currency: Currency;
	/** At most this much (what the pot or the account holds). */
	max: Cents;
	/** Asks for the other organization's address too (a confidential payment). */
	withRecipient?: boolean;
	/** Organizations to pick from: the address book's and the person's own. */
	suggestions?: readonly { name: string; address: string }[];
	busy: boolean;
	onSubmit: (amount: Cents, to: string) => Promise<boolean>;
};

/** One pot step with an amount: move in, take out, or pay another organization's pot. */
export function PotAmountForm({
	title,
	hint,
	action,
	currency,
	max,
	withRecipient = false,
	suggestions = [],
	busy,
	onSubmit,
}: Props) {
	const t = useT();
	const id = useId();
	const [amount, setAmount] = useState("");
	const [to, setTo] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const cents = parseAmountInput(amount);
		if (cents === null || cents <= 0) {
			setError(t("Enter an amount above zero."));
			return;
		}
		if (cents > max) {
			setError(t("At most {amount}.", { amount: formatMoney(max, currency) }));
			return;
		}
		if (withRecipient && !StrKey.isValidContract(to.trim())) {
			setError(t("Enter the other organization's account address (starts with C)."));
			return;
		}
		setError(null);
		setWorking(true);
		const done = await onSubmit(cents, to.trim());
		setWorking(false);
		if (done) {
			setAmount("");
			setTo("");
		}
	};

	return (
		<form className={styles.form} onSubmit={submit} noValidate aria-label={title}>
			<h3>{title}</h3>
			<p className={styles.muted}>{hint}</p>
			{withRecipient && (
				<Field label={t("Their organization's address")} htmlFor={`${id}-to`}>
					<input
						id={`${id}-to`}
						className={controlClass}
						placeholder="C…"
						spellCheck={false}
						list={`${id}-orgs`}
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
					<datalist id={`${id}-orgs`}>
						{suggestions.map((s) => (
							<option key={s.address} value={s.address}>
								{s.name}
							</option>
						))}
					</datalist>
				</Field>
			)}
			<Field label={t("Amount ({currency})", { currency })} htmlFor={`${id}-amount`} error={error}>
				<input
					id={`${id}-amount`}
					className={controlClass}
					inputMode="decimal"
					autoComplete="off"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
				/>
			</Field>
			<div className={styles.actions}>
				<button type="submit" className={buttonClass("secondary")} disabled={busy}>
					{working ? t("Working on it…") : action}
				</button>
			</div>
		</form>
	);
}
