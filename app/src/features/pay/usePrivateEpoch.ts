import { useEffect, useState } from "react";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** The organization's private-details key epoch: 0 while references are readable by anyone. */
export function usePrivateEpoch(orgId: string): number {
	const { dataSource } = useWorkspace();
	const support = dataSource.privacy;
	const [epoch, setEpoch] = useState(0);
	useEffect(() => {
		if (!support) return;
		let current = true;
		void support.epoch(orgId).then((value) => {
			if (current) setEpoch(value);
		});
		return () => {
			current = false;
		};
	}, [support, orgId]);
	return epoch;
}
