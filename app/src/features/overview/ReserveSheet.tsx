import { type FormEvent, useState } from "react";
import { availableBalance, balanceOf, currencyOf, type OrgAccount } from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Sheet } from "../../ui/Sheet.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./ReserveSheet.module.css";

export type ReserveDirection = "in" | "out";

type ReserveSheetProps = {
	account: OrgAccount;
	token: string;
	direction: ReserveDirection | null;
	onClose: () => void;
};

/** One-tap move between the main account and the Reserve. */
export function ReserveSheet({ account, token, direction, onClose }: ReserveSheetProps) {
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const toReserve = direction === "in";
	const currency = currencyOf(account, token);
	const max = toReserve ? availableBalance(account, token) : balanceOf(account, token).reserve;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const amount = parseAmountInput(input);
		if (amount === null) {
			setError("Enter an amount like 500 or 1,250.50.");
			return;
		}
		const orgId = account.org.id;
		const result = await run(
			() =>
				toReserve
					? dataSource.moveToReserve(orgId, me.id, token, amount)
					: dataSource.withdrawFromReserve(orgId, me.id, token, amount),
			{
				signature: {
					kind: "passkey",
					title: `Move ${formatMoney(amount, currency)} ${toReserve ? "to the Reserve" : "to the main account"}`,
				},
				success: "Done. The balances are updated.",
			},
		);
		if (result?.ok) {
			setInput("");
			setError(null);
			onClose();
		}
	};

	return (
		<Sheet
			open={direction !== null}
			title={toReserve ? "Move to the Reserve" : "Move to the main account"}
			onClose={onClose}
		>
			<form className={styles.form} onSubmit={submit}>
				<Field
					label="Amount"
					htmlFor="reserve-amount"
					hint={`Up to ${formatMoney(max, currency)}`}
					error={error}
				>
					<input
						id="reserve-amount"
						className={controlClass}
						inputMode="decimal"
						autoComplete="off"
						placeholder="0.00"
						value={input}
						onChange={(e) => setInput(e.target.value)}
					/>
				</Field>
				<div className={styles.actions}>
					<button type="button" className={buttonClass("secondary")} onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className={buttonClass()} disabled={busy}>
						Move
					</button>
				</div>
			</form>
		</Sheet>
	);
}
