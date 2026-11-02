import { useEffect, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { potItems, type StatementItem } from "../../domain/statement.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** The pot's label wherever statement rows name their asset. */
export const POT_LABEL = "Confidential pot";

/**
 * The confidential pot's private payments as statement items, read with this person's keys (a
 * member, or an auditor with access); none while loading or when there is no readable pot.
 */
export function usePotItems(account: OrgAccount, payee: (id: string) => string): StatementItem[] {
	const { dataSource, me } = useWorkspace();
	const support = dataSource.pot;
	const [items, setItems] = useState<StatementItem[]>([]);
	const currency = account.org.assets.find((a) => a.token === support?.asset())?.currency;

	useEffect(() => {
		if (!support || !currency || !account.onchain?.pot) return;
		let current = true;
		void support.history(account, me.id).then((result) => {
			if (!current || !result.ok || !result.value) return;
			const ledger = { contract: support.contract(), currency, label: POT_LABEL };
			setItems(potItems(result.value, ledger, { payee }));
		});
		return () => {
			current = false;
		};
	}, [support, currency, account, me.id, payee]);

	return items;
}
