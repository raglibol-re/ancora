import { Keypair, Operation } from "@stellar/stellar-sdk";
import { isOrganization, isSmartAccount } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer, simulatedResourceFee } from "./_lib/ledger.js";
import { parseSubmission, validateSubmission } from "./_lib/relayRules.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Fee-sponsoring relayer for smart-account-kit: validate, cap the fee, then submit with the demo
// operator's key as the fee-paying source. The validation guarantees the sponsor only signs the
// envelope; every authorization in the call comes from the smart account (or the kit's deployer).
// OpenZeppelin Relayer Channels was the first choice, but its free testnet budget (100 XLM per
// key per day) can't cover current testnet resource prices (~40–50 XLM per passkey transaction).

// Testnet cap. Deploying a smart account currently costs ~20–40 XLM in resource fees, almost all
// of it rent for the account's long-lived storage (measured: ~1 KB written, ~2.7M instructions),
// far above the reference proxy's 0.1 XLM, and rising with testnet's state size. 300 XLM still
// bounds what one request can spend; the operator float is refilled by scripts/setup-testnet.sh.
const MAX_RESOURCE_FEE_STROOPS = 3_000_000_000n;

export const config = { maxDuration: 60 };

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const submission = parseSubmission(await readJsonObject(request));
	await validateSubmission(
		{
			accountWasmHash: settings.accountWasmHash,
			isSmartAccount: (contractId) => isSmartAccount(settings, contractId),
			isTrustedTarget: async (contractId) =>
				(settings.registryContract !== "" && contractId === settings.registryContract) ||
				(settings.recoveryContract !== "" && contractId === settings.recoveryContract) ||
				(settings.orgWasmHash !== "" && (await isOrganization(settings, contractId))),
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
	// Security invariant: the sponsor key is read only after validation and the fee check.
	const sponsor = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const hash = await invokeAsServer(
		settings,
		sponsor,
		Operation.invokeHostFunction({ func: submission.func, auth: submission.auth }),
	);
	return { hash, status: "SUCCESS", transactionId: null };
});
