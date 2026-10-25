import { Keypair, Operation, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { tokenBalance } from "../shared/tokenBalance.js";
import { requireAdmin } from "./_lib/adminAuth.js";
import { readDemoState, writeDemoState } from "./_lib/demoState.js";
import { contractsHealth, operatorHealth, rentHealth, rpcHealth } from "./_lib/health.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Demo admin (operator tool, testnet only). Everything here is read-only except the demo-mode
// switch and the XLM top-up of the operator's own fee float. The operator key is not a signer
// on any organization account: it cannot move org funds or change org rules.

export const config = { maxDuration: 60 };

/**
 * Friendbot funds each new account once, so a throwaway key is funded and merged into the
 * operator, handing over its XLM. Same mechanism as scripts/setup-testnet.sh, from the browser.
 */
async function refillXlmFromFriendbot(settings: ReturnType<typeof serverConfig>): Promise<string> {
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const server = new rpc.Server(settings.rpcUrl);
	const { friendbotUrl } = await server.getNetwork();
	if (!friendbotUrl) throw new RequestError("This network has no Friendbot.", 400);
	const helper = Keypair.random();
	const funded = await fetch(`${friendbotUrl}?addr=${helper.publicKey()}`);
	if (!funded.ok)
		throw new RequestError("Friendbot didn't fund a helper account. Try again later.", 502);
	const source = await server.getAccount(helper.publicKey());
	const tx = new TransactionBuilder(source, {
		fee: "10000",
		networkPassphrase: settings.networkPassphrase,
	})
		.addOperation(Operation.accountMerge({ destination: operator.publicKey() }))
		.setTimeout(60)
		.build();
	tx.sign(helper);
	const sent = await server.sendTransaction(tx);
	if (sent.status === "ERROR") throw new RequestError("The network rejected the merge.", 502);
	const final = await server.pollTransaction(sent.hash, { attempts: 20 });
	if (final.status !== "SUCCESS") {
		throw new RequestError(`The merge ended with status ${final.status}.`, 502);
	}
	return sent.hash;
}

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
		case "refill-xlm": {
			const nativeToken = typeof body.nativeToken === "string" ? body.nativeToken : null;
			const hash = await refillXlmFromFriendbot(settings);
			const operator = Keypair.fromSecret(required("DEPLOYER_SECRET")).publicKey();
			const xlmStroops = nativeToken
				? (await tokenBalance(settings, nativeToken, operator)).toString()
				: null;
			return { hash, xlmStroops };
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
