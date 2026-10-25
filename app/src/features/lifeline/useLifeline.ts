import { useCallback, useEffect, useRef, useState } from "react";
import type { LifelineOverview } from "../../domain/lifeline.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** My Lifeline state (plan, open claim, people I protect), reloaded on demand. */
export function useLifeline() {
	const { dataSource, me } = useWorkspace();
	const [overview, setOverview] = useState<LifelineOverview | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Only the latest load may publish its result; older ones are dropped.
	const latest = useRef(0);

	const reload = useCallback(() => {
		const request = ++latest.current;
		void dataSource.lifeline.overview(me.id).then((result) => {
			if (request !== latest.current) return;
			if (result.ok) {
				setOverview(result.value);
				setError(null);
			} else {
				setError(result.error.message);
			}
		});
	}, [dataSource, me.id]);

	useEffect(() => {
		reload();
		return () => {
			latest.current += 1;
		};
	}, [reload]);

	return { overview, error, reload };
}
