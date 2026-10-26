import { Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { isOrganization } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Runs a standing order that is due. The contract lets anyone call this
// (the member authorized the schedule when setting it); the operator pays the fee.

export const config = { maxDuration: 60 };

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { organization, orderId } = await readJsonObject(request);
	if (typeof organization !== "string" || !StrKey.isValidContract(organization)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	if (typeof orderId !== "number" || !Number.isSafeInteger(orderId) || orderId < 1) {
		throw new RequestError("Send the standing order id.");
	}
	if (!(await isOrganization(settings, organization))) {
		throw new RequestError("That contract is not an ancora organization.", 403);
	}
	const hash = await invokeAsServer(
		settings,
		Keypair.fromSecret(required("DEPLOYER_SECRET")),
		new Contract(organization).call("run_standing_order", nativeToScVal(orderId, { type: "u64" })),
	);
	return { hash };
});
