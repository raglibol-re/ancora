/**
 * Reads several screens ask for at once (Lifeline, passkeys): the first caller starts the read,
 * everyone who asks under the same key within `ttlMs` gets that same answer.
 */
export class SharedReads {
	private readonly memo = new Map<string, { at: number; value: Promise<unknown> }>();
	private readonly now: () => number;

	constructor(now: () => number = Date.now) {
		this.now = now;
	}

	remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
		const hit = this.memo.get(key);
		if (hit && this.now() - hit.at < ttlMs) return hit.value as Promise<T>;
		const value = load();
		this.memo.set(key, { at: this.now(), value });
		return value;
	}

	/** Drops the reads whose key starts with the prefix, so the next caller reads again. */
	forget(prefix: string): void {
		for (const key of this.memo.keys()) if (key.startsWith(prefix)) this.memo.delete(key);
	}

	clear(): void {
		this.memo.clear();
	}
}
