import { StellarToml, WebAuth } from "@stellar/stellar-sdk";
import type { AnchorInfo, AnchorSession, AnchorTransaction } from "../../domain/dataSource.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import { parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";
import { assetName, signWithWallet } from "./walletFunding.ts";

// A Stellar anchor is the bridge between a bank and Stellar. It publishes its endpoints in
// stellar.toml (SEP-1), signs people in with their wallet key (SEP-10) and hosts its own
// deposit and withdrawal forms (SEP-24). ancora never sees bank details: the anchor's form
// opens in its own window and the wallet only signs a sign-in challenge. On testnet the SDF
// test anchor pays out test USDC; a licensed anchor would do the same with euros.

type Anchor = {
	homeDomain: string;
	webAuth: string;
	transfer: string;
	signingKey: string;
	/** Accepted token contract → the asset code the anchor knows it by. */
	codes: ReadonlyMap<string, string>;
};

type TransactionRecord = Record<string, unknown>;

const failed = (message: string) => err(ruleError("not-allowed", message));

const anchors = new Map<string, Promise<Anchor>>();
/** SEP-10 tokens per wallet address, for the session; the anchor sets their expiry. */
const sessions = new Map<string, string>();

function loadAnchor(config: TestnetConfig): Promise<Anchor> {
	const cached = anchors.get(config.anchorHomeDomain);
	if (cached) return cached;
	const loading = (async (): Promise<Anchor> => {
		const toml = await StellarToml.Resolver.resolve(config.anchorHomeDomain);
		const webAuth = toml.WEB_AUTH_ENDPOINT;
		const transfer = toml.TRANSFER_SERVER_SEP0024;
		const signingKey = toml.SIGNING_KEY;
		if (!webAuth || !transfer || !signingKey) {
			throw new Error(`${config.anchorHomeDomain} doesn't offer SEP-24 deposits and withdrawals.`);
		}
		if (toml.NETWORK_PASSPHRASE && toml.NETWORK_PASSPHRASE !== config.networkPassphrase) {
			throw new Error(`${config.anchorHomeDomain} runs on another Stellar network.`);
		}
		// Anchors name assets by code and issuer; the accepted tokens report the same pair as their name.
		const anchorAssets = new Map<string, string>(
			(toml.CURRENCIES ?? [])
				.filter((c) => c.code && c.issuer)
				.map((c) => [`${c.code}:${c.issuer}`, String(c.code)] as const),
		);
		const codes = new Map<string, string>();
		await Promise.all(
			parseAssetOptions(config.orgAssets).map(async (asset) => {
				const name = await assetName(config, asset.token).catch(() => "");
				const code = anchorAssets.get(name);
				if (code) codes.set(asset.token, code);
			}),
		);
		return { homeDomain: config.anchorHomeDomain, webAuth, transfer, signingKey, codes };
	})();
	anchors.set(config.anchorHomeDomain, loading);
	loading.catch(() => anchors.delete(config.anchorHomeDomain));
	return loading;
}

/** True when the token's `exp` claim is within a minute of now (or unreadable). */
function expired(jwt: string): boolean {
	try {
		const payload = jwt.split(".")[1] ?? "";
		const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
			exp?: number;
		};
		return typeof claims.exp !== "number" || claims.exp * 1000 < Date.now() + 60_000;
	} catch {
		return true;
	}
}

/** SEP-10: the anchor issues a challenge transaction, the wallet signs it, the anchor returns a token. */
async function signIn(config: TestnetConfig, anchor: Anchor, wallet: string): Promise<string> {
	const cached = sessions.get(wallet);
	if (cached && !expired(cached)) return cached;
	const query = new URLSearchParams({ account: wallet, home_domain: anchor.homeDomain });
	const challengeResponse = await fetch(`${anchor.webAuth}?${query}`);
	if (!challengeResponse.ok) {
		throw new Error(`The anchor refused to start sign-in (HTTP ${challengeResponse.status}).`);
	}
	const challenge = (await challengeResponse.json()) as {
		transaction?: string;
		network_passphrase?: string;
	};
	if (!challenge.transaction) throw new Error("The anchor sent no sign-in challenge.");
	if (challenge.network_passphrase && challenge.network_passphrase !== config.networkPassphrase) {
		throw new Error("The anchor's sign-in challenge is for another network.");
	}
	// Checks the server's signature, sequence 0, time bounds and the home domain before signing.
	const read = WebAuth.readChallengeTx(
		challenge.transaction,
		anchor.signingKey,
		config.networkPassphrase,
		anchor.homeDomain,
		new URL(anchor.webAuth).host,
	);
	if (read.clientAccountID !== wallet) {
		throw new Error("The anchor's sign-in challenge was for another account.");
	}
	const signed = await signWithWallet(challenge.transaction, config.networkPassphrase, wallet);
	const tokenResponse = await fetch(anchor.webAuth, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ transaction: signed }),
	});
	if (!tokenResponse.ok) {
		throw new Error(
			`The anchor didn't accept the signed challenge (HTTP ${tokenResponse.status}).`,
		);
	}
	const { token } = (await tokenResponse.json()) as { token?: string };
	if (!token) throw new Error("The anchor returned no session token.");
	sessions.set(wallet, token);
	return token;
}

async function interactive(
	config: TestnetConfig,
	kind: "deposit" | "withdraw",
	token: string,
	wallet: string,
): Promise<Result<AnchorSession, RuleError>> {
	try {
		const anchor = await loadAnchor(config);
		const code = anchor.codes.get(token);
		if (!code) return failed(`${anchor.homeDomain} doesn't handle this asset.`);
		const jwt = await signIn(config, anchor, wallet);
		const response = await fetch(`${anchor.transfer}/transactions/${kind}/interactive`, {
			method: "POST",
			headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
			body: JSON.stringify({ asset_code: code, account: wallet, lang: "en" }),
		});
		if (!response.ok) {
			return failed(`The anchor couldn't start the ${kind} (HTTP ${response.status}).`);
		}
		const body = (await response.json()) as { type?: string; url?: string; id?: string };
		if (body.type !== "interactive_customer_info_needed" || !body.url || !body.id) {
			return failed("The anchor answered in a way ancora doesn't understand.");
		}
		return ok({ id: body.id, url: body.url });
	} catch (error) {
		return failed(describe(error, `The ${kind} couldn't be started.`));
	}
}

function mapTransaction(record: TransactionRecord): AnchorTransaction {
	const text = (key: string): string | null => {
		const value = record[key];
		return typeof value === "string" && value !== "" ? value : null;
	};
	const account = text("withdraw_anchor_account");
	const memo = text("withdraw_memo");
	return {
		id: String(record.id ?? ""),
		kind: record.kind === "withdrawal" ? "withdrawal" : "deposit",
		status: String(record.status ?? "unknown"),
		amountIn: text("amount_in"),
		amountOut: text("amount_out"),
		message: text("message"),
		stellarTxHash: text("stellar_transaction_id"),
		withdrawTo: account && memo ? { account, memo } : null,
	};
}

/** The anchor and which accepted tokens it can move in and out. */
export async function anchorInfo(config: TestnetConfig): Promise<Result<AnchorInfo, RuleError>> {
	try {
		const anchor = await loadAnchor(config);
		const tokens = [...anchor.codes.keys()];
		return ok({ homeDomain: anchor.homeDomain, depositable: tokens, withdrawable: tokens });
	} catch (error) {
		return failed(describe(error, "The anchor couldn't be reached."));
	}
}

export const startDeposit = (config: TestnetConfig, token: string, wallet: string) =>
	interactive(config, "deposit", token, wallet);

export const startWithdrawal = (config: TestnetConfig, token: string, wallet: string) =>
	interactive(config, "withdraw", token, wallet);

/** The anchor's current record of a deposit or withdrawal. */
export async function anchorTransaction(
	config: TestnetConfig,
	wallet: string,
	id: string,
): Promise<Result<AnchorTransaction, RuleError>> {
	try {
		const anchor = await loadAnchor(config);
		const jwt = await signIn(config, anchor, wallet);
		const response = await fetch(`${anchor.transfer}/transaction?id=${encodeURIComponent(id)}`, {
			headers: { authorization: `Bearer ${jwt}` },
		});
		if (response.status === 401 || response.status === 403) {
			sessions.delete(wallet);
			return failed("The anchor session ended. Start again to sign in once more.");
		}
		if (!response.ok)
			return failed(`The anchor couldn't report the status (HTTP ${response.status}).`);
		const body = (await response.json()) as { transaction?: TransactionRecord };
		if (!body.transaction) return failed("The anchor has no record of this transaction.");
		return ok(mapTransaction(body.transaction));
	} catch (error) {
		return failed(describe(error, "The anchor couldn't be reached."));
	}
}

function describe(error: unknown, fallback: string): string {
	const message = error instanceof Error ? error.message : "";
	return message ? `${fallback} ${message}` : fallback;
}
