import { StrKey } from "@stellar/stellar-sdk";
import { type FormEvent, useId, useState } from "react";
import { type Cents, type Currency, parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
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
	busy,
	onSubmit,
}: Props) {
	const id = useId();
	const [amount, setAmount] = useState("");
	const [to, setTo] = useState("");
	const [error, setError] = useState<string | null>(null);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const cents = parseAmountInput(amount);
		if (cents === null || cents <= 0) {
			setError("Enter an amount above zero.");
			return;
		}
		if (cents > max) {
			setError(`At most ${formatMoney(max, currency)}.`);
			return;
		}
		if (withRecipient && !StrKey.isValidContract(to.trim())) {
			setError("Enter the other organization's account address (starts with C).");
			return;
		}
		setError(null);
		if (await onSubmit(cents, to.trim())) {
			setAmount("");
			setTo("");
		}
	};

	return (
		<form className={styles.form} onSubmit={submit} noValidate aria-label={title}>
			<h3>{title}</h3>
			<p className={styles.muted}>{hint}</p>
			{withRecipient && (
				<Field label="Their organization's address" htmlFor={`${id}-to`}>
					<input
						id={`${id}-to`}
						className={controlClass}
						placeholder="C…"
						spellCheck={false}
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
				</Field>
			)}
			<Field label={`Amount (${currency})`} htmlFor={`${id}-amount`} error={error}>
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
					{action}
				</button>
			</div>
		</form>
	);
}
