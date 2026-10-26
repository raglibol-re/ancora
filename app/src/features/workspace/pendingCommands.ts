import { useSyncExternalStore } from "react";

// What the app is doing in the background right now: a passkey prompt, a transaction on its
// way to Stellar. Commands register here while they run; the shell shows one working bar for
// all of them, so a wait of a few seconds never looks like nothing is happening.

type Pending = { id: number; label: string };

let pending: Pending[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

/** Marks a command as running; call the returned function when it is done. */
export function beginCommand(label: string): () => void {
	const entry = { id: nextId++, label };
	pending = [...pending, entry];
	notify();
	return () => {
		pending = pending.filter((p) => p.id !== entry.id);
		notify();
	};
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The most recent running command's label, or null when nothing is running. */
export function usePendingCommand(): string | null {
	const current = useSyncExternalStore(subscribe, () => pending);
	return current.at(-1)?.label ?? null;
}
