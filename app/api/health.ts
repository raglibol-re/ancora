import { readDemoState } from "./_lib/demoState.js";
import { rpcHealth } from "./_lib/health.js";
import { apiHandler } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// Public: the app asks this on load to pick its data source (site-wide demo mode, and whether
// the Stellar testnet answers), and falls back to sample data when it can't be reached.

export const config = { maxDuration: 15 };

export default apiHandler("GET", async () => {
	const [demo, rpc] = await Promise.all([readDemoState(), rpcHealth(serverConfig())]);
	return { mode: demo.mode, updatedAt: demo.updatedAt, rpc };
});
