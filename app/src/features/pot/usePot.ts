import { useCallback, useEffect, useRef, useState } from "react";
import type { PotStatus } from "../../domain/dataSource.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** The organization's confidential pot as this person and device see it, with a reload. */
export function usePot(orgId: string) {
	const { dataSource, me } = useWorkspace();
	const support = dataSource.pot;
	const [status, setStatus] = useState<PotStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result.
	const latest = useRef(0);

	const load = useCallback(() => {
		if (!support) return;
		const request = ++latest.current;
		void support.status(orgId, me.id).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) {
				setStatus(result.value);
				setError(null);
			} else setError(result.error.message);
		});
	}, [support, orgId, me.id]);

	useEffect(() => {
		load();
		return () => {
			latest.current += 1;
		};
	}, [load]);

	return { support, status, error, load };
}
