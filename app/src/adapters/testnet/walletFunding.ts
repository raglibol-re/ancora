import { Contract, rpc, TransactionBuilder } from "@stellar/stellar-sdk";
import { tokenBalance } from "../../../shared/tokenBalance.ts";
import { shortAddress } from "../../domain/account.ts";
import type { ConnectedWallet } from "../../domain/dataSource.ts";
import type { Cents } from "../../domain/money.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import type { Network } from "./readContract.ts";
import { readContract } from "./readContract.ts";
import { address, i128, toCents, toStroops } from "./scv.ts";

// Money from the person's own Stellar wallet (Freighter, Hana, xBull, Albedo) into the
// organization. Wallets' plain "send" builds a classic payment, which can't target a contract
// address, so ancora builds the token `transfer(wallet → organization)` invocation and the
// wallet only signs it. Connection and signing go through Stellar Wallets Kit; this module is
// loaded on demand so the kit never weighs on people who don't use it.

const failed = (message: string) => err(ruleError("not-allowed", message));
const BASE_FEE = "100";
const CONFIRMATION_POLLS = 30;
const POLL_MS = 1_000;

let initialized = false;

async function kit() {
	const [{ StellarWalletsKit, Networks }, freighter, hana, xbull, albedo] = await Promise.all([
		import("@creit.tech/stellar-wallets-kit"),
		import("@creit.tech/stellar-wallets-kit/modules/freighter"),
		import("@creit.tech/stellar-wallets-kit/modules/hana"),
		import("@creit.tech/stellar-wallets-kit/modules/xbull"),
		import("@creit.tech/stellar-wallets-kit/modules/albedo"),
	]);
	if (!initialized) {
		StellarWalletsKit.init({
			modules: [
				new freighter.FreighterModule(),
				new hana.HanaModule(),
				new xbull.xBullModule(),
				new albedo.AlbedoModule(),
			],
			network: Networks.TESTNET,
		});
		initialized = true;
	}
	return StellarWalletsKit;
}

/** Opens the wallet picker (inside `container` when given); the chosen wallet stays selected. */
export async function connectWallet(
	container?: HTMLElement,
): Promise<Result<ConnectedWallet, RuleError>> {
	try {
		const wallets = await kit();
		const { address: account } = await wallets.authModal(container ? { container } : undefined);
		return ok({ address: account, walletName: wallets.selectedModule.productName });
	} catch (error) {
		return failed(describe(error, "No wallet was connected."));
	}
}

export async function disconnectWallet(): Promise<void> {
	const wallets = await kit();
	await wallets.disconnect().catch(() => undefined);
}

/** What the wallet holds of `token`, in cents; 0 without a trustline. */
export async function walletBalance(
	network: Network,
	token: string,
	holder: string,
): Promise<Cents> {
	return toCents(await tokenBalance(network, token, holder));
}

/** "USDC:GATALT…" for a classic asset, so people can add exactly the right trustline. */
export async function assetName(network: Network, token: string): Promise<string> {
	return String(await readContract(network, token, "name"));
}

/** Has the connected wallet sign a transaction for `address`; resolves to the signed XDR. */
export async function signWithWallet(
	xdr: string,
	networkPassphrase: string,
	address: string,
): Promise<string> {
	const wallets = await kit();
	const signed = await wallets.signTransaction(xdr, { networkPassphrase, address });
	return signed.signedTxXdr;
}

/** Transfers `amount` of `token` from the connected wallet to the organization; returns the hash. */
export async function depositFromWallet(
	network: Network,
	token: string,
	from: string,
	organization: string,
	amount: Cents,
): Promise<Result<string, RuleError>> {
	const server = new rpc.Server(network.rpcUrl);
	const account = await server.getAccount(from).catch(() => null);
	if (!account) {
		return failed("Your wallet account isn't active on testnet yet. Fund it with Friendbot first.");
	}
	const stroops = toStroops(amount);
	const held = await tokenBalance(network, token, from);
	if (held < stroops) {
		const name = await assetName(network, token).catch(() => "this asset");
		return failed(
			held === 0n
				? `Your wallet ${shortAddress(from)} holds none of ${name}. It needs a trustline for exactly this asset and some balance.`
				: `Your wallet holds only ${(Number(held) / 10_000_000).toFixed(2)} of ${name}.`,
		);
	}
	const tx = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: network.networkPassphrase,
	})
		.addOperation(
			new Contract(token).call("transfer", address(from), address(organization), i128(stroops)),
		)
		.setTimeout(180)
		.build();
	let prepared: ReturnType<typeof TransactionBuilder.fromXDR>;
	try {
		prepared = await server.prepareTransaction(tx);
	} catch (error) {
		return failed(describe(error, "The transfer couldn't be prepared."));
	}
	let signedXdr: string;
	try {
		signedXdr = await signWithWallet(prepared.toXDR(), network.networkPassphrase, from);
	} catch (error) {
		return failed(describe(error, "The wallet didn't sign the transfer."));
	}
	const sent = await server.sendTransaction(
		TransactionBuilder.fromXDR(signedXdr, network.networkPassphrase),
	);
	if (sent.status === "ERROR") {
		return failed(
			"The network rejected the transfer. Check the wallet's XLM balance and try again.",
		);
	}
	for (let attempt = 0; attempt < CONFIRMATION_POLLS; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
		const status = await server.getTransaction(sent.hash);
		if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return ok(sent.hash);
		if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
			return failed("The transfer failed on the network. Nothing left your wallet.");
		}
	}
	return failed(
		"The transfer is taking longer than usual. Check your wallet's history in a minute.",
	);
}

function describe(error: unknown, fallback: string): string {
	const message = error instanceof Error ? error.message : String(error);
	if (/#13\b/.test(message)) {
		return "Your wallet has no trustline for this exact asset (testnet has several assets called USDC).";
	}
	if (/#10\b/.test(message)) return "Your wallet doesn't hold enough of this asset.";
	if (/reject|cancel|denied|closed/i.test(message)) return fallback;
	return `${fallback} ${message.slice(0, 160)}`.trim();
}
