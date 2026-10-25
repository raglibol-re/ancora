import { submitToChannels } from "./_lib/channels.js";
import { postHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { isSmartAccount, simulatedResourceFee } from "./_lib/ledger.js";
import { parseSubmission, validateSubmission } from "./_lib/relayRules.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Fee-sponsoring relayer for smart-account-kit: validate, cap the fee, forward to OZ Channels.

// Testnet cap: a smart-account deployment with its passkey constructor needs more than the
// 0.1 XLM the reference proxy allows; 0.5 XLM still bounds abuse of the sponsor.
const MAX_RESOURCE_FEE_STROOPS = 5_000_000n;

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
