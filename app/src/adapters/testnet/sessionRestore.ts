/** A session restore slower than this stops blocking the screen; a cached pass stays signed in. */
export const RESTORE_TIMEOUT_MS = 8_000;

type Deps = {
	/** The pass this device showed from its cache, or null. */
	cachedId: string | null;
	/** Asks the passkey kit for the session this device had; answers its account, or null. */
	reconnect: () => Promise<string | null>;
	/** Reads the cached pass's organizations again. */
	refresh: () => Promise<void>;
	/** Makes the account the signed-in person. */
	become: (id: string) => Promise<void>;
	/** Forgets the cached pass and shows the sign-in page. */
	forget: () => void;
	wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Brings the session back when the page loads. The passkey session check and the chain reads
 * don't depend on each other, so they run together. Resolves once the screen may stop waiting;
 * on a slow network that is before the kit has answered, and the session is followed later.
 */
export async function restoreSession(deps: Deps): Promise<void> {
	const { cachedId } = deps;

	/** Follows the session the kit found: another pass, the cached one, or none on this device. */
	const settle = async (sessionId: string | null) => {
		if (sessionId && sessionId !== cachedId) await deps.become(sessionId);
		// Otherwise the cache belonged to a session this device no longer has.
		else if (!sessionId && cachedId) deps.forget();
	};

	try {
		const connection = deps.reconnect();
		const [outcome] = await Promise.all([
			Promise.race([
				connection.then((sessionId) => ({ sessionId })),
				(deps.wait ?? sleep)(RESTORE_TIMEOUT_MS).then(() => "slow" as const),
			]),
			cachedId ? deps.refresh() : Promise.resolve(),
		]);
		if (outcome === "slow") {
			// A slow network is not a signed-out device: keep what the cache shows and settle once
			// the kit answers.
			void connection.then(settle).catch(() => settle(null));
			return;
		}
		await settle(outcome.sessionId);
	} catch {
		// No usable session on this device: the sign-in page takes over.
		if (cachedId) deps.forget();
	}
}
