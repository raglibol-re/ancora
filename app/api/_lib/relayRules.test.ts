import { Address, Keypair, nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { parseSubmission, type RelayContext, validateSubmission } from "./relayRules.js";

const contract = () => StrKey.encodeContract(Keypair.random().rawPublicKey());
const WALLET = contract();
const TOKEN = contract();
const RECIPIENT = Keypair.random().publicKey();

const context = (smartAccounts: string[] = [WALLET]): RelayContext => ({
	accountWasmHash: "ab".repeat(32),
	isSmartAccount: async (id) => smartAccounts.includes(id),
});

function invoke(target: string, fn: string, args: xdr.ScVal[]) {
	return new xdr.InvokeContractArgs({
		contractAddress: new Address(target).toScAddress(),
		functionName: fn,
		args,
	});
}

const transferArgs = (from: string) => [
	new Address(from).toScVal(),
	new Address(RECIPIENT).toScVal(),
	nativeToScVal(10_000_000n, { type: "i128" }),
];

function walletAuth(
	signer: string,
	call: xdr.InvokeContractArgs,
	sub: xdr.SorobanAuthorizedInvocation[] = [],
) {
	return new xdr.SorobanAuthorizationEntry({
		credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(
			new xdr.SorobanAddressCredentials({
				address: new Address(signer).toScAddress(),
				nonce: xdr.Int64.fromString("1"),
				signatureExpirationLedger: 100,
				signature: xdr.ScVal.scvVoid(),
			}),
		),
		rootInvocation: new xdr.SorobanAuthorizedInvocation({
			function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
			subInvocations: sub,
		}),
	});
}

const submission = (call: xdr.InvokeContractArgs, auth: xdr.SorobanAuthorizationEntry[]) => ({
	func: xdr.HostFunction.hostFunctionTypeInvokeContract(call),
	auth,
});

describe("parseSubmission", () => {
	it("rejects signed envelopes and unknown fields", () => {
		expect(() => parseSubmission({ xdr: "AAAA" })).toThrow(/func, auth/);
		expect(() => parseSubmission({ func: "x", auth: ["y"], extra: 1 })).toThrow();
	});

	it("rejects missing auth and invalid XDR", () => {
		expect(() => parseSubmission({ func: "x", auth: [] })).toThrow(/auth/);
		expect(() => parseSubmission({ func: "not-xdr", auth: ["nope"] })).toThrow(/XDR/);
	});

	it("round-trips a valid submission", () => {
		const call = invoke(TOKEN, "transfer", transferArgs(WALLET));
		const { func, auth } = submission(call, [walletAuth(WALLET, call)]);
		const parsed = parseSubmission({
			func: func.toXDR("base64"),
			auth: auth.map((a) => a.toXDR("base64")),
		});
		expect(parsed.auth).toHaveLength(1);
	});
});

describe("validateSubmission", () => {
	it("accepts a transfer authorized by an ancora account", async () => {
		const call = invoke(TOKEN, "transfer", transferArgs(WALLET));
		await expect(
			validateSubmission(context(), submission(call, [walletAuth(WALLET, call)])),
		).resolves.toBeUndefined();
	});

	it("accepts V1 address credentials, which simulation currently returns for smart accounts", async () => {
		const call = invoke(TOKEN, "transfer", transferArgs(WALLET));
		const v2 = walletAuth(WALLET, call);
		const v1 = new xdr.SorobanAuthorizationEntry({
			credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(v2.credentials().addressV2()),
			rootInvocation: v2.rootInvocation(),
		});
		await expect(validateSubmission(context(), submission(call, [v1]))).resolves.toBeUndefined();
	});

	it("refuses transfers from accounts that aren't ancora smart accounts", async () => {
		const other = contract();
		const call = invoke(TOKEN, "transfer", transferArgs(other));
		await expect(
			validateSubmission(context(), submission(call, [walletAuth(other, call)])),
		).rejects.toThrow(/ancora accounts/);
	});

	it("refuses an authorization that signs a different call than the one submitted", async () => {
		const call = invoke(TOKEN, "transfer", transferArgs(WALLET));
		const signed = invoke(TOKEN, "transfer", [
			new Address(WALLET).toScVal(),
			new Address(RECIPIENT).toScVal(),
			nativeToScVal(1n, { type: "i128" }),
		]);
		await expect(
			validateSubmission(context(), submission(call, [walletAuth(WALLET, signed)])),
		).rejects.toThrow(/does not match/);
	});

	it("never relays source-account authorizations (the relayer must not authorize anything)", async () => {
		const call = invoke(WALLET, "add_signer", []);
		const sourceAuth = new xdr.SorobanAuthorizationEntry({
			credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
			rootInvocation: walletAuth(WALLET, call).rootInvocation(),
		});
		await expect(validateSubmission(context(), submission(call, [sourceAuth]))).rejects.toThrow(
			/account-signed/,
		);
	});

	it("refuses account functions outside the allowlist, such as upgrade", async () => {
		const call = invoke(WALLET, "upgrade", []);
		await expect(
			validateSubmission(context(), submission(call, [walletAuth(WALLET, call)])),
		).rejects.toThrow(/not relayed/);
	});

	it("refuses account calls whose authorization reaches into other contracts", async () => {
		const call = invoke(WALLET, "execute", []);
		const nested = new xdr.SorobanAuthorizedInvocation({
			function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
				invoke(TOKEN, "transfer", transferArgs(WALLET)),
			),
			subInvocations: [],
		});
		await expect(
			validateSubmission(context(), submission(call, [walletAuth(WALLET, call, [nested])])),
		).rejects.toThrow(/does not match/);
	});
});
