// What the app is doing in the background right now: a passkey prompt, a transaction on its
// way to Stellar, a wallet signing a transfer. Adapters register each piece of work while it
// runs; the shell shows one working bar for all of them, so a wait of a few seconds never
// looks like nothing is happening. Pure state: React subscribes through a hook in features.

type Work = { id: number; label: string };

let pending: readonly Work[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) listener();
}

/** Marks work as running; call the returned function when it is done (always, also on error). */
export function beginWork(label: string): () => void {
	const entry = { id: nextId++, label };
	pending = [...pending, entry];
	notify();
	return () => {
		pending = pending.filter((p) => p.id !== entry.id);
		notify();
	};
}

/** Runs `task` as a piece of work, whatever its outcome. */
export async function withWork<T>(label: string, task: () => Promise<T>): Promise<T> {
	const done = beginWork(label);
	try {
		return await task();
	} finally {
		done();
	}
}

export function subscribeToWork(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The pieces of work running now, oldest first. */
export function pendingWork(): readonly Work[] {
	return pending;
}
