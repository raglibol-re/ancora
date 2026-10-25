import { Address, Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { postHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer, isSmartAccount, tokenBalance } from "./_lib/ledger.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Testnet only: the demo operator sends test USDC from its float to an ancora smart account.
// The operator is never a signer on any organization account; it can only give, not take.

const STROOPS_PER_USDC = 10_000_000n;
const GRANT = 500n * STROOPS_PER_USDC;
const MAX_BALANCE_FOR_GRANT = 5_000n * STROOPS_PER_USDC;

export const config = { maxDuration: 60 };

export default postHandler(async (request) => {
	const settings = serverConfig();
	const { contractId } = await readJsonObject(request);
	if (typeof contractId !== "string" || !StrKey.isValidContract(contractId)) {
		throw new RequestError("Send the organization's account address (C…).");
	}
	if (!(await isSmartAccount(settings, contractId))) {
		throw new RequestError("Test money only goes to ancora accounts.", 403);
	}
	if ((await tokenBalance(settings, settings.usdcToken, contractId)) >= MAX_BALANCE_FOR_GRANT) {
		throw new RequestError("This account already has plenty of test money.", 429);
	}
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const hash = await invokeAsServer(
		settings,
		operator,
		new Contract(settings.usdcToken).call(
			"transfer",
			new Address(operator.publicKey()).toScVal(),
			new Address(contractId).toScVal(),
			nativeToScVal(GRANT, { type: "i128" }),
		),
	);
	return { hash, amountStroops: GRANT.toString() };
});
