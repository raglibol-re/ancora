import { randomBytes } from "node:crypto";
import {
	Address,
	Contract,
	Keypair,
	nativeToScVal,
	Operation,
	StrKey,
	xdr,
} from "@stellar/stellar-sdk";
import { deployedContractId, isSmartAccount } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { type OrgAsset, required, serverConfig } from "./_lib/serverConfig.js";

// The operator deploys the organization contract and registers it. The founder (a person's
// smart account) is the organization's first and only member; the operator holds no role. The
// contract stores the SHA-256 of the template's policy document so anyone can verify the rules,
// and starts with the stablecoins the founder picked from the allowlist.

const TEMPLATES = new Set(["club", "company", "team"]);
const CURRENCIES = new Set(["EUR", "USD"]);
const MAX_NAME_BYTES = 64;

export const config = { maxDuration: 60 };

const symbol = (value: string) => nativeToScVal(value, { type: "symbol" });

/** The contract's `AssetSpec` struct: map keys in sorted order, as Soroban encodes structs. */
function assetSpec(asset: OrgAsset): xdr.ScVal {
	return xdr.ScVal.scvMap([
		new xdr.ScMapEntry({ key: symbol("currency"), val: symbol(asset.currency) }),
		new xdr.ScMapEntry({ key: symbol("token"), val: new Address(asset.token).toScVal() }),
		new xdr.ScMapEntry({
			key: symbol("vault"),
			val: asset.vault ? new Address(asset.vault).toScVal() : xdr.ScVal.scvVoid(),
		}),
	]);
}

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { founder, founderRole, template, name, policyHash, baseCurrency, assets } =
		await readJsonObject(request);
	if (typeof founder !== "string" || !StrKey.isValidContract(founder)) {
		throw new RequestError("The founder must be an ancora account address (C…).");
	}
	if (typeof template !== "string" || !TEMPLATES.has(template)) {
		throw new RequestError("Pick one of the templates: club, company or team.");
	}
	if (typeof founderRole !== "string" || !/^[a-z]{1,32}$/.test(founderRole)) {
		throw new RequestError("Pick one of the template's roles.");
	}
	if (typeof name !== "string" || !name.trim() || Buffer.byteLength(name.trim()) > MAX_NAME_BYTES) {
		throw new RequestError("Give the organization a name of up to 64 characters.");
	}
	if (typeof policyHash !== "string" || !/^[0-9a-f]{64}$/.test(policyHash)) {
		throw new RequestError("The rules document hash must be 64 hex characters.");
	}
	if (typeof baseCurrency !== "string" || !CURRENCIES.has(baseCurrency)) {
		throw new RequestError("Pick EUR or USD as the currency of the rules.");
	}
	if (!Array.isArray(assets) || assets.length === 0 || assets.length > settings.orgAssets.size) {
		throw new RequestError("Pick at least one asset the organization accepts.");
	}
	const accepted = assets.map((token) => {
		const asset = typeof token === "string" ? settings.orgAssets.get(token) : undefined;
		if (!asset) throw new RequestError("One of the assets isn't available on ancora.");
		return asset;
	});
	if (new Set(accepted.map((a) => a.token)).size !== accepted.length) {
		throw new RequestError("Each asset can be picked once.");
	}
	if (!(await isSmartAccount(settings, founder))) {
		throw new RequestError("Only an ancora account can found an organization.", 403);
	}

	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const salt = randomBytes(32);
	const contractId = deployedContractId(settings.networkPassphrase, operator.publicKey(), salt);
	const constructorArgs = [
		new Address(settings.registryContract).toScVal(),
		symbol(baseCurrency),
		xdr.ScVal.scvVec(accepted.map(assetSpec)),
		new Address(founder).toScVal(),
		symbol(founderRole),
		symbol(template),
		nativeToScVal(name.trim(), { type: "string" }),
		xdr.ScVal.scvBytes(Buffer.from(policyHash, "hex")),
	];
	const deployHash = await invokeAsServer(
		settings,
		operator,
		Operation.createCustomContract({
			address: new Address(operator.publicKey()),
			wasmHash: Buffer.from(settings.orgWasmHash, "hex"),
			salt,
			constructorArgs,
		}),
	);
	// The registry only accepts membership updates from organizations the operator registered.
	const registerHash = await invokeAsServer(
		settings,
		operator,
		new Contract(settings.registryContract).call(
			"register_org",
			new Address(contractId).toScVal(),
			new Address(founder).toScVal(),
		),
	);
	return { contractId, deployHash, registerHash };
});
