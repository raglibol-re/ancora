import { StrKey } from "@stellar/stellar-sdk";
import { isOrganization } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { rememberOrganization } from "./_lib/organizationIndex.js";
import { serverConfig } from "./_lib/serverConfig.js";

// The app tells the server about an organization it opened, so organizations created before
// the index existed are visited by the scheduler too. Only registered organizations are kept.

export const config = { maxDuration: 15 };

export default apiHandler("POST", async (request) => {
	const { organization } = await readJsonObject(request);
	if (typeof organization !== "string" || !StrKey.isValidContract(organization)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	if (!(await isOrganization(serverConfig(), organization))) {
		throw new RequestError("That contract is not an ancora organization.", 403);
	}
	await rememberOrganization(organization);
	return { indexed: true };
});
