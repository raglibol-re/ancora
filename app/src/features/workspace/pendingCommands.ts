import { useSyncExternalStore } from "react";
import { pendingWork, subscribeToWork } from "../../domain/pendingWork.ts";

/** The most recent running piece of work's label, or null when nothing is running. */
export function usePendingCommand(): string | null {
	const current = useSyncExternalStore(subscribeToWork, pendingWork);
	return current.at(-1)?.label ?? null;
}
