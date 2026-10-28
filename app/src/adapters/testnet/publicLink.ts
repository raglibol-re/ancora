import { StrKey } from "@stellar/stellar-sdk";
import type { Cents } from "../../domain/money.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import { ContractReadError, readContract } from "./readContract.ts";
import { toCents, u64 } from "./scv.ts";
import { testnetConfig } from "./testnetConfig.ts";
import { connectWallet, payLinkFromWallet, walletBalance } from "./walletFunding.ts";

// What the public pay page needs, without an ancora pass: read one payment link of one
// organization from its contract, connect the payer's own wallet, and pay.

export type PublicLink = {
	organization: string;
	orgName: string;
	logoUrl: string | null;
	token: string;
	symbol: string;
	currency: "EUR" | "USD";
	amount: Cents;
	memo: string;
	open: boolean;
	paidCount: number;
	maxPayments: number;
};

const failed = (message: string) => err(ruleError("not-allowed", message));

type Native = Record<string, unknown>;

export async function readPublicLink(
	organization: string,
	linkId: string,
): Promise<Result<PublicLink, RuleError>> {
	const config = testnetConfig;
	if (!config) return failed("ancora isn't connected to Stellar here.");
	if (!StrKey.isValidContract(organization) || !/^\d+$/.test(linkId)) {
		return failed("This payment link is incomplete. Ask the organization to send it again.");
	}
	try {
		const [info, link, assets] = await Promise.all([
			readContract(config, organization, "info") as Promise<Native>,
			readContract(config, organization, "link", [u64(Number(linkId))]) as Promise<Native>,
			readContract(config, organization, "assets") as Promise<Native[]>,
		]);
		const token = String(link.token);
		const asset = assets.find((a) => String(a.token) === token);
		return ok({
			organization,
			orgName: String(info.name),
			logoUrl: info.logo ? String(info.logo) : null,
			token,
			symbol: asset ? String(asset.symbol) : "",
			currency: asset && String(asset.currency) === "EUR" ? "EUR" : "USD",
			amount: toCents(BigInt(link.amount as bigint)),
			memo: String(link.memo),
			open: Boolean(link.open),
			paidCount: Number(link.paid_count),
			maxPayments: Number(link.max_payments),
		});
	} catch (error) {
		return failed(
			error instanceof ContractReadError
				? "This payment link doesn't exist, or the organization's account can't take payment links."
				: "Stellar can't be reached right now. Try again in a moment.",
		);
	}
}

export { connectWallet };

export async function balanceOf(token: string, wallet: string): Promise<Cents> {
	return testnetConfig ? walletBalance(testnetConfig, token, wallet) : 0;
}

export async function payLink(
	link: PublicLink,
	linkId: string,
	wallet: string,
): Promise<Result<string, RuleError>> {
	if (!testnetConfig) return failed("ancora isn't connected to Stellar here.");
	const paid = await payLinkFromWallet(
		testnetConfig,
		link.organization,
		linkId,
		link.token,
		link.amount,
		wallet,
	);
	return paid.ok ? ok(paid.value) : paid;
}
