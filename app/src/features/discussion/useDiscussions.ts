import { useCallback, useEffect, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

export type DiscussionsStatus = "loading" | "ready" | "failed";

/**
 * Discussions live on ancora's server, not on Stellar, and are read only where requests are
 * shown: a screen calls this for the organizations on it. The entries arrive in the workspace;
 * this reports whether they are there yet, and reads them again on `retry`.
 */
export function useDiscussions(accounts: readonly OrgAccount[]): {
	status: DiscussionsStatus;
	retry: () => void;
} {
	const { dataSource } = useWorkspace();
	const [status, setStatus] = useState<DiscussionsStatus>("loading");
	// A discussion hangs on a request, so organizations without one aren't asked about; as a
	// string, so the same organizations in a new array don't count as a change.
	const orgIds = [...new Set(accounts.filter((a) => a.requests.length > 0).map((a) => a.org.id))]
		.sort()
		.join(",");

	const load = useCallback(async () => {
		setStatus("loading");
		const result = await dataSource.discussions.load(orgIds === "" ? [] : orgIds.split(","));
		setStatus(result.ok ? "ready" : "failed");
	}, [dataSource, orgIds]);

	useEffect(() => {
		void load();
	}, [load]);

	return { status, retry: load };
}
