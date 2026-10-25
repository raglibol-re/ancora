import { Asset, Keypair, rpc, StrKey, xdr } from "@stellar/stellar-sdk";
import { shortAddress } from "../../domain/account.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import { type Network, readContract } from "./readContract.ts";

const refuse = (message: string) => err(ruleError("not-allowed", message));

export type RecipientNetwork = Network & { horizonUrl: string };

/**
 * Testnet has several assets called "USDC" (Circle's, Blend's, …). When the recipient holds one
 * with another issuer, naming it is the only way the person understands what to add. Horizon
 * lists an account's trustlines; RPC can only look one up by exact asset. [] if unknown.
 */
async function otherIssuersOf(
	horizonUrl: string,
	account: string,
	code: string,
): Promise<string[]> {
	try {
		const response = await fetch(`${horizonUrl}/accounts/${account}`);
		if (!response.ok) return [];
		const body = (await response.json()) as {
			balances?: { asset_code?: string; asset_issuer?: string }[];
		};
		return (body.balances ?? [])
			.filter((b) => b.asset_code === code && typeof b.asset_issuer === "string")
			.map((b) => b.asset_issuer as string);
	} catch {
		return [];
	}
}

/**
 * A classic Stellar account (G…) can only receive USDC once it holds a trustline for it; a
 * contract address (C…) always can. Checked before a payment is requested, because the token
 * contract would otherwise fail at execution with a bare error code (#13, trustline missing)
 * that the person can't act on.
 */
export async function checkRecipient(
	network: RecipientNetwork,
	token: string,
	to: string,
): Promise<Result<void, RuleError>> {
	if (StrKey.isValidContract(to)) return ok(undefined);
	if (!StrKey.isValidEd25519PublicKey(to)) {
		return refuse("Enter the recipient's Stellar address (starts with G or C).");
	}
	const server = new rpc.Server(network.rpcUrl);
	const exists = await server.getAccount(to).then(
		() => true,
		() => false,
	);
	if (!exists) {
		return refuse(
			"This Stellar address doesn't exist on testnet yet. The recipient has to fund it first (for example with Friendbot).",
		);
	}
	// The asset contract reports its classic asset as "CODE:ISSUER"; native XLM needs no trustline.
	const [code, issuer] = String(await readContract(network, token, "name")).split(":");
	if (!code || !issuer) return ok(undefined);
	const key = xdr.LedgerKey.trustline(
		new xdr.LedgerKeyTrustLine({
			accountId: Keypair.fromPublicKey(to).xdrAccountId(),
			asset: new Asset(code, issuer).toTrustLineXDRObject(),
		}),
	);
	const { entries } = await server.getLedgerEntries(key);
	const entry = entries[0];
	if (!entry) {
		const others = await otherIssuersOf(network.horizonUrl, to, code);
		const holds =
			others.length > 0
				? `This address holds ${code} from a different issuer (${others.map(shortAddress).join(", ")}), which ancora doesn't pay out. `
				: `This Stellar address can't receive ${code} yet: it has no ${code} trustline. `;
		return refuse(
			`${holds}Payments go out as ${code} issued by ${issuer}. Ask the recipient to add a trustline for exactly that asset in their wallet, or pay an ancora organization by its address.`,
		);
	}
	const authorized =
		(entry.val.trustLine().flags() & xdr.TrustLineFlags.authorizedFlag().value) !== 0;
	if (!authorized) {
		return refuse(`This Stellar address holds ${code} but isn't authorized to receive it.`);
	}
	return ok(undefined);
}
