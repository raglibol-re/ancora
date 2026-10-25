import { Address, hash, Keypair, xdr } from "@stellar/stellar-sdk";
import { RequestError } from "./http.js";

// Fail-closed checks before ancora pays a fee, modelled on stellar/smart-account-kit's reference
// relayer-proxy. They limit what the relayer pays for; they do not prove wallet ownership (the
// kit verifies that client-side, and the smart account itself enforces its signers on-chain).

const MAX_AUTH_ENTRIES = 8;

/** The kit's public, sign-only default deployer (derived from a well-known seed). */
export const SHARED_DEPLOYER = Keypair.fromRawEd25519Seed(
	hash(Buffer.from("openzeppelin-smart-account-kit")),
).publicKey();

/** Smart-account entry points the relayer will pay for (administration through the account). */
export const WALLET_FUNCTIONS = new Set([
	"execute",
	"add_policy",
	"remove_policy",
	"add_signer",
	"remove_signer",
	"add_context_rule",
	"remove_context_rule",
	"batch_add_signer",
	"update_context_rule_name",
	"update_context_rule_valid_until",
]);

export type Submission = { func: xdr.HostFunction; auth: xdr.SorobanAuthorizationEntry[] };

export type RelayContext = {
	accountWasmHash: string;
	isSmartAccount: (contractId: string) => Promise<boolean>;
};

const refuse = (message: string) => new RequestError(message, 403);
const sameXdr = (a: { toXDR(): Buffer }, b: { toXDR(): Buffer }) => a.toXDR().equals(b.toXDR());
const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

export function parseSubmission(body: Record<string, unknown>): Submission {
	const { func, auth } = body;
	if (Object.keys(body).some((key) => key !== "func" && key !== "auth")) {
		throw new RequestError("Only { func, auth } submissions are accepted.");
	}
	if (typeof func !== "string" || !Array.isArray(auth) || auth.length === 0) {
		throw new RequestError("The request needs 'func' and at least one 'auth' entry.");
	}
	if (auth.length > MAX_AUTH_ENTRIES) {
		throw new RequestError(`At most ${MAX_AUTH_ENTRIES} auth entries are allowed.`);
	}
	try {
		return {
			func: xdr.HostFunction.fromXDR(func, "base64"),
			auth: auth.map((entry) => xdr.SorobanAuthorizationEntry.fromXDR(String(entry), "base64")),
		};
	} catch {
		throw new RequestError("'func' or 'auth' is not valid XDR.");
	}
}

export async function validateSubmission(context: RelayContext, submission: Submission) {
	const { func, auth } = submission;
	switch (func.switch().name) {
		case "hostFunctionTypeCreateContractV2":
			return validateDeployment(context, func.createContractV2(), auth);
		case "hostFunctionTypeInvokeContract": {
			const invoke = func.invokeContract();
			return invoke.functionName().toString() === "transfer"
				? validateTransfer(context, invoke, auth)
				: validateWalletCall(context, invoke, auth);
		}
		default:
			throw refuse("Only contract calls and smart-account deployments are relayed.");
	}
}

function validateDeployment(
	context: RelayContext,
	deploy: xdr.CreateContractArgsV2,
	auth: xdr.SorobanAuthorizationEntry[],
) {
	const executable = deploy.executable();
	if (
		executable.switch().name !== "contractExecutableWasm" ||
		toHex(executable.wasmHash()) !== context.accountWasmHash
	) {
		throw refuse("Only ancora smart accounts can be deployed.");
	}
	const preimage = deploy.contractIdPreimage();
	if (preimage.switch().name !== "contractIdPreimageFromAddress") {
		throw refuse("The deployment must be derived from the deployer address.");
	}
	const deployer = Address.fromScAddress(preimage.fromAddress().address()).toString();
	if (deployer !== SHARED_DEPLOYER) throw refuse("Unknown deployer.");
	validateOnePasskeyConstructor(deploy);

	const entry = auth[0];
	if (auth.length !== 1 || !entry) throw refuse("A deployment carries exactly one authorization.");
	const credentials = entry.credentials();
	const root = entry.rootInvocation();
	if (
		credentials.switch().name !== "sorobanCredentialsAddress" ||
		Address.fromScAddress(credentials.address().address()).toString() !== deployer ||
		root.subInvocations().length !== 0 ||
		root.function().switch().name !== "sorobanAuthorizedFunctionTypeCreateContractV2HostFn" ||
		!sameXdr(root.function().createContractV2HostFn(), deploy)
	) {
		throw refuse("The deployment authorization does not match the deployment.");
	}
}

/** One External passkey signer whose credential id derives the salt: the kit's wallet shape. */
function validateOnePasskeyConstructor(deploy: xdr.CreateContractArgsV2) {
	const [signers, policies] = deploy.constructorArgs();
	const signer = signers?.switch().name === "scvVec" ? signers.vec() : null;
	const fields = signer?.[0]?.switch().name === "scvVec" ? (signer[0].vec() ?? []) : [];
	const keyData = fields[2]?.switch().name === "scvBytes" ? fields[2].bytes() : null;
	if (
		deploy.constructorArgs().length !== 2 ||
		policies?.switch().name !== "scvMap" ||
		signer?.length !== 1 ||
		fields[0]?.switch().name !== "scvSymbol" ||
		fields[0].sym().toString() !== "External" ||
		!keyData ||
		keyData.length <= 65 ||
		keyData[0] !== 0x04
	) {
		throw refuse("A new account must start with exactly one passkey signer.");
	}
	const salt = deploy.contractIdPreimage().fromAddress().salt();
	if (!hash(keyData.subarray(65)).equals(salt)) {
		throw refuse("The account address does not match its passkey.");
	}
}

async function validateTransfer(
	context: RelayContext,
	invoke: xdr.InvokeContractArgs,
	auth: xdr.SorobanAuthorizationEntry[],
) {
	const [from] = invoke.args();
	if (invoke.args().length !== 3 || from?.switch().name !== "scvAddress") {
		throw refuse("The transfer has an unexpected shape.");
	}
	const sender = Address.fromScAddress(from.address()).toString();
	if (!(await context.isSmartAccount(sender))) throw refuse("Only ancora accounts can send.");
	for (const entry of auth) {
		const root = entry.rootInvocation();
		if (
			signerOf(entry) !== sender ||
			root.subInvocations().length !== 0 ||
			root.function().switch().name !== "sorobanAuthorizedFunctionTypeContractFn" ||
			!sameXdr(root.function().contractFn(), invoke)
		) {
			throw refuse("The transfer authorization does not match the transfer.");
		}
	}
}

async function validateWalletCall(
	context: RelayContext,
	invoke: xdr.InvokeContractArgs,
	auth: xdr.SorobanAuthorizationEntry[],
) {
	const wallet = Address.fromScAddress(invoke.contractAddress()).toString();
	if (!WALLET_FUNCTIONS.has(invoke.functionName().toString())) {
		throw refuse("This account function is not relayed.");
	}
	if (!(await context.isSmartAccount(wallet))) throw refuse("Only ancora accounts are relayed.");
	for (const entry of auth) {
		const root = entry.rootInvocation();
		if (
			signerOf(entry) !== wallet ||
			root.function().switch().name !== "sorobanAuthorizedFunctionTypeContractFn" ||
			!sameXdr(root.function().contractFn(), invoke) ||
			!onlyTargets(root, wallet)
		) {
			throw refuse("The authorization does not match the account call.");
		}
	}
}

/** Address-bound V2 credentials only: the relayer's own account must never authorize anything. */
function signerOf(entry: xdr.SorobanAuthorizationEntry): string {
	const credentials = entry.credentials();
	if (credentials.switch().name !== "sorobanCredentialsAddressV2") {
		throw refuse("Only account-signed authorizations are relayed.");
	}
	return Address.fromScAddress(credentials.addressV2().address()).toString();
}

function onlyTargets(invocation: xdr.SorobanAuthorizedInvocation, contractId: string): boolean {
	const fn = invocation.function();
	return (
		fn.switch().name === "sorobanAuthorizedFunctionTypeContractFn" &&
		Address.fromScAddress(fn.contractFn().contractAddress()).toString() === contractId &&
		invocation.subInvocations().every((child) => onlyTargets(child, contractId))
	);
}
