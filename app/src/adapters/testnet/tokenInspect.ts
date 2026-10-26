import { Asset, StrKey } from "@stellar/stellar-sdk";
import type { TokenInfo } from "../../domain/dataSource.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import { type Network, readContract } from "./readContract.ts";

// Any Stellar asset can be accepted by an organization: a token contract address (C…) or a
// classic asset written as CODE:ISSUER, which maps to its Stellar Asset Contract. The token
// itself answers what it is called; the organization contract reads the same when it accepts it.

const failed = (message: string) => err(ruleError("unknown-asset", message));

/** The contract id behind a reference, or null when the text is neither form. */
export function resolveTokenReference(reference: string, networkPassphrase: string): string | null {
	const text = reference.trim();
	if (StrKey.isValidContract(text)) return text;
	const [code, issuer] = text.split(":");
	if (
		code &&
		issuer &&
		/^[A-Za-z0-9]{1,12}$/.test(code) &&
		StrKey.isValidEd25519PublicKey(issuer)
	) {
		return new Asset(code, issuer).contractId(networkPassphrase);
	}
	return null;
}

/** Asks the token contract what it is; refuses anything that doesn't answer like a token. */
export async function inspectToken(
	network: Network,
	reference: string,
): Promise<Result<TokenInfo, RuleError>> {
	const token = resolveTokenReference(reference, network.networkPassphrase);
	if (!token) {
		return failed(
			"Enter a token contract address (C…) or a classic asset as CODE:ISSUER, like USDC:GBBD…",
		);
	}
	try {
		const [symbol, name, decimals] = await Promise.all([
			readContract(network, token, "symbol"),
			readContract(network, token, "name"),
			readContract(network, token, "decimals"),
		]);
		if (typeof symbol !== "string" || typeof name !== "string") {
			return failed("This contract doesn't describe itself as a token.");
		}
		return ok({ token, symbol, name, decimals: Number(decimals) });
	} catch (error) {
		return failed(
			`No token answered at ${token.slice(0, 8)}… ${error instanceof Error ? error.message : ""}`.trim(),
		);
	}
}
