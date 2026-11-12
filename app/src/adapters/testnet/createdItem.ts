// What a command just created (a request, a payment link) is found by its id: the one that
// wasn't there before. The read right after a transaction can come from an RPC node that hasn't
// seen its ledger yet, so the chain is read again for a few seconds before giving up.

/** How often, and how far apart, the chain is read again for something just created. */
export const CREATED_READS = 6;
export const CREATED_WAIT_MS = 1_500;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The id in `ids()` that isn't in `before`. While there is none, waits and calls `readAgain`,
 * up to CREATED_READS times; "" when it still isn't there, and the screen then opens the list
 * instead of the new item.
 */
export async function createdId(
	ids: () => readonly string[],
	before: readonly string[],
	readAgain: () => Promise<void>,
	wait: (ms: number) => Promise<void> = pause,
): Promise<string> {
	const known = new Set(before);
	for (let read = 0; ; read++) {
		const id = ids().find((candidate) => !known.has(candidate));
		if (id !== undefined) return id;
		if (read === CREATED_READS) return "";
		await wait(CREATED_WAIT_MS);
		await readAgain();
	}
}
