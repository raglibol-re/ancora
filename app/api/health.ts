import { readDemoState } from "./_lib/demoState.js";
import { rpcHealth } from "./_lib/health.js";
import { apiHandler } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";
import { testMoneyAvailability } from "./_lib/testMoney.js";

// Public: the app asks this on load to pick its data source (site-wide demo mode, and whether
// the Stellar testnet answers), and falls back to sample data when it can't be reached.

export const config = { maxDuration: 15 };

/** Test money is a hint for the Add money sheet; a slow RPC must not hold up the data source. */
const TEST_MONEY_WAIT_MS = 3_000;

function within<T>(ms: number, promise: Promise<T>, fallback: T): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
	]);
}

export default apiHandler("GET", async () => {
	const settings = serverConfig();
	const [demo, rpc, testMoney] = await Promise.all([
		readDemoState(),
		rpcHealth(settings),
		// Which assets the operator can hand out right now; empty (unknown) when it can't be read
		// in time.
		within(
			TEST_MONEY_WAIT_MS,
			testMoneyAvailability(settings).catch(() => []),
			[],
		),
	]);
	return { mode: demo.mode, updatedAt: demo.updatedAt, rpc, testMoney };
});
