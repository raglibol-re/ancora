import { submitToChannels } from "./_lib/channels.js";
import { postHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { isSmartAccount, simulatedResourceFee } from "./_lib/ledger.js";
import { parseSubmission, validateSubmission } from "./_lib/relayRules.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Fee-sponsoring relayer for smart-account-kit: validate, cap the fee, forward to OZ Channels.

const MAX_RESOURCE_FEE_STROOPS = 1_000_000n;

export const config = { maxDuration: 60 };

export default postHandler(async (request) => {
	const settings = serverConfig();
	const body = await readJsonObject(request);
	const submission = parseSubmission(body);
	await validateSubmission(
		{
			accountWasmHash: settings.accountWasmHash,
			isSmartAccount: (contractId) => isSmartAccount(settings, contractId),
		},
		submission,
	);
	const fee = await simulatedResourceFee(settings, submission.func, submission.auth);
	if (fee > MAX_RESOURCE_FEE_STROOPS) {
		throw new RequestError("This transaction is too expensive to sponsor.", 413);
	}
	// Security invariant: the API key is read only after validation and the fee check.
	return submitToChannels(settings.relayerBaseUrl, required("RELAYER_API_KEY"), {
		func: body.func as string,
		auth: body.auth as string[],
	});
});
