import { Address, Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { tokenBalance } from "../shared/tokenBalance.js";
import { isOrganization } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { required, serverConfig } from "./_lib/serverConfig.js";
import { grantFor, STROOPS_PER_UNIT } from "./_lib/testMoney.js";

// Testnet only: the demo operator sends test money in one of the accepted stablecoins from its
// float to an ancora organization. The operator holds no role in any organization; it can only
// give, not take.

const MAX_BALANCE_FOR_GRANT = 5_000n * STROOPS_PER_UNIT;

export const config = { maxDuration: 60 };

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { contractId, token } = await readJsonObject(request);
	if (typeof contractId !== "string" || !StrKey.isValidContract(contractId)) {
		throw new RequestError("Send the organization's account address (C…).");
	}
	const asset = typeof token === "string" ? settings.orgAssets.get(token) : undefined;
	if (!asset) throw new RequestError("Test money is available only in the accepted stablecoins.");
	if (!(await isOrganization(settings, contractId))) {
		throw new RequestError("Test money only goes to ancora organizations.", 403);
	}
	if ((await tokenBalance(settings, asset.token, contractId)) >= MAX_BALANCE_FOR_GRANT) {
		throw new RequestError(`This organization already has plenty of test ${asset.symbol}.`, 429);
	}
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const grant = grantFor(await tokenBalance(settings, asset.token, operator.publicKey()));
	if (grant < STROOPS_PER_UNIT) {
		throw new RequestError(
			`ancora's test float of ${asset.symbol} is empty right now. Try another asset or later.`,
			503,
		);
	}
	const hash = await invokeAsServer(
		settings,
		operator,
		new Contract(asset.token).call(
			"transfer",
			new Address(operator.publicKey()).toScVal(),
			new Address(contractId).toScVal(),
			nativeToScVal(grant, { type: "i128" }),
		),
	);
	return { hash, amountStroops: grant.toString(), symbol: asset.symbol };
});
