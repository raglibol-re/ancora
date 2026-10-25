import { submitToChannels } from "./_lib/channels.js";
import { postHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { isSmartAccount, simulatedResourceFee } from "./_lib/ledger.js";
import { parseSubmission, validateSubmission } from "./_lib/relayRules.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Fee-sponsoring relayer for smart-account-kit: validate, cap the fee, forward to OZ Channels.

// Testnet cap. Deploying a smart account currently costs ~20–40 XLM in resource fees, almost all
// of it rent for the account's long-lived storage (measured: ~1 KB written, ~2.7M instructions),
// far above the reference proxy's 0.1 XLM. 100 XLM still bounds what one request can spend.
const MAX_RESOURCE_FEE_STROOPS = 1_000_000_000n;

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
		throw new RequestError(
			`This transaction is too expensive to sponsor (${fee} stroops, limit ${MAX_RESOURCE_FEE_STROOPS}).`,
			413,
		);
	}
	// Security invariant: the API key is read only after validation and the fee check.
	return submitToChannels(settings.relayerBaseUrl, required("RELAYER_API_KEY"), {
		func: body.func as string,
		auth: body.auth as string[],
	});
});
