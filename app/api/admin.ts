import { requireAdmin } from "./_lib/adminAuth.js";
import { readDemoState, writeDemoState } from "./_lib/demoState.js";
import { contractsHealth, operatorHealth, rentHealth, rpcHealth } from "./_lib/health.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { serverConfig } from "./_lib/serverConfig.js";

// Demo admin (operator tool, testnet only). Everything here is read-only except the demo-mode
// switch. The operator key is not a signer on any organization account: it cannot move org
// funds or change org rules.

export const config = { maxDuration: 30 };

type ContractInput = { label: string; id: string };

function contractList(value: unknown): ContractInput[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((c): c is ContractInput => typeof c?.label === "string" && typeof c?.id === "string")
		.slice(0, 20);
}

export default apiHandler("POST", async (request) => {
	requireAdmin(request, process.env.ADMIN_PASSPHRASE);
	const settings = serverConfig();
	const body = await readJsonObject(request);

	switch (body.action) {
		case "health": {
			const nativeToken = typeof body.nativeToken === "string" ? body.nativeToken : null;
			const [demo, rpc, rent, contracts, operator] = await Promise.all([
				readDemoState(),
				rpcHealth(settings),
				rentHealth(settings),
				contractsHealth(settings, contractList(body.contracts)),
				nativeToken ? operatorHealth(settings, nativeToken) : null,
			]);
			return {
				demo,
				rpc,
				rent,
				contracts,
				operator,
				relayer: { allowedOrigins: [...settings.allowedOrigins], rpcUrl: settings.rpcUrl },
			};
		}
		case "set-mode": {
			if (body.mode !== "sample" && body.mode !== "testnet") {
				throw new RequestError("Mode must be 'sample' or 'testnet'.");
			}
			return { demo: await writeDemoState(body.mode) };
		}
		default:
			throw new RequestError("Unknown action.");
	}
});
