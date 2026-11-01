import { useCallback, useEffect, useRef, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { Deal } from "../../domain/deals.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** The organization's deals, read again whenever its requests change (a step may have run). */
export function useDeals(account: OrgAccount) {
	const { dataSource } = useWorkspace();
	const support = dataSource.deals;
	const [deals, setDeals] = useState<Deal[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result.
	const latest = useRef(0);
	const requestsVersion = account.requests.map((r) => `${r.id}:${r.status}`).join(",");

	const reload = useCallback(() => {
		if (!support) return;
		const request = ++latest.current;
		void support.list(account.org.id).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) {
				setDeals(result.value);
				setError(null);
			} else {
				setError(result.error.message);
			}
		});
	}, [support, account.org.id]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: requestsVersion is the trigger
	useEffect(() => {
		reload();
		return () => {
			latest.current += 1;
		};
	}, [reload, requestsVersion]);

	return { support, deals, error, reload };
}
