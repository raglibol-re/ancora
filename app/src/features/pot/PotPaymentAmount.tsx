import { useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { PotRequest } from "../../domain/rules/requests.ts";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Pot.module.css";

/**
 * A confidential payment's amount, which the network can't see: read on this device with the
 * pot key when asked (it loads the pot's cryptography, so not before).
 */
export function PotPaymentAmount({
	account,
	request,
}: {
	account: OrgAccount;
	request: PotRequest;
}) {
	const t = useT();
	const { dataSource, me } = useWorkspace();
	const { run, busy } = useCommand();
	const [amount, setAmount] = useState<string | null>(null);
	const support = dataSource.pot;
	if (!support || request.action.type !== "pay") return null;
	const { sealed } = request.action;

	if (amount)
		return (
			<p className={styles.meta}>
				{t("Amount (private on the network):")} {amount}
			</p>
		);
	return (
		<button
			type="button"
			className={styles.linkButton}
			disabled={busy}
			onClick={async () => {
				const result = await run(() => support.amountOf(account.org.id, me.id, sealed));
				if (result?.ok) setAmount(formatMoney(result.value, request.currency));
			}}
		>
			{t("Show the amount")}
		</button>
	);
}
