import { Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { isOrganization } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Executes a request whose objection window has passed. The contract lets anyone call this
// (the decision was taken when the approvals completed); the operator pays the fee.

export const config = { maxDuration: 60 };

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { organization, requestId } = await readJsonObject(request);
	if (typeof organization !== "string" || !StrKey.isValidContract(organization)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	if (typeof requestId !== "number" || !Number.isSafeInteger(requestId) || requestId < 1) {
		throw new RequestError("Send the request id.");
	}
	if (!(await isOrganization(settings, organization))) {
		throw new RequestError("That contract is not an ancora organization.", 403);
	}
	const hash = await invokeAsServer(
		settings,
		Keypair.fromSecret(required("DEPLOYER_SECRET")),
		new Contract(organization).call("execute", nativeToScVal(requestId, { type: "u64" })),
	);
	return { hash };
});
