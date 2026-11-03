import { createHash } from "node:crypto";
import {
	type Account,
	Keypair,
	Operation,
	type rpc,
	TransactionBuilder,
} from "@stellar/stellar-sdk";
import { rpcServer } from "../../shared/rpcServer.js";
import type { ServerConfig } from "./serverConfig.js";

// Channel accounts let server transactions run side by side. Stellar Core keeps one pending
// transaction per source account, so with the operator as the source every server transaction
// waited for the one before it. Now each transaction comes from one of a few channel accounts
// (its sequence number), its one operation keeps the operator as source (the operator's
// authorization), and a fee bump lets the operator pay the fee, so a channel needs no more than
// its reserve. Verified on testnet on 1 Nov 2026: three fee bumps from the operator over three
// channels landed in the same ledger. See developers.stellar.org: channel accounts, fee-bump
// transactions.

/** Enough for the bursts ancora sees (a few people signing at once); each is one more account. */
export const CHANNEL_COUNT = 8;
/** The base reserve twice over: the account plus room for the fee-bumped transactions. */
const CHANNEL_STARTING_BALANCE = "1.5";
/** How often a new channel is looked for, a ledger apart, before giving up. */
const CREATE_WAIT_ATTEMPTS = 6;

/**
 * The channel keys follow from the operator's secret, so every function instance knows them
 * without another secret to configure, and nobody without the operator's secret does.
 */
export function channelKeypair(operator: Keypair, index: number): Keypair {
	const seed = createHash("sha256")
		.update(operator.rawSecretKey())
		.update(`ancora/channel/${index}`)
		.digest();
	return Keypair.fromRawEd25519Seed(seed);
}

/** How many channels exist on the network now (the admin health panel shows it). */
export async function readyChannels(config: ServerConfig, operator: Keypair): Promise<number> {
	const server = rpcServer(config.rpcUrl);
	const found = await Promise.all(
		Array.from({ length: CHANNEL_COUNT }, (_, index) =>
			server.getAccount(channelKeypair(operator, index).publicKey()).then(
				() => 1,
				() => 0,
			),
		),
	);
	return found.reduce<number>((sum, one) => sum + one, 0);
}

/** A random channel and its current account state; missing channels are created first. */
export async function pickChannel(
	config: ServerConfig,
	operator: Keypair,
): Promise<{ keypair: Keypair; account: Account }> {
	const server = rpcServer(config.rpcUrl);
	const keypair = channelKeypair(operator, Math.floor(Math.random() * CHANNEL_COUNT));
	const existing = await server.getAccount(keypair.publicKey()).catch(() => null);
	if (existing) return { keypair, account: existing };
	await createMissingChannels(server, config, operator);
	return { keypair, account: await awaitAccount(server, keypair.publicKey()) };
}

/** Another instance may have won the race to create the channels; its transaction lands soon. */
async function awaitAccount(server: rpc.Server, id: string): Promise<Account> {
	for (let attempt = 1; ; attempt++) {
		const account = await server.getAccount(id).catch((error: unknown) => {
			if (attempt >= CREATE_WAIT_ATTEMPTS) throw error;
			return null;
		});
		if (account) return account;
		await new Promise((resolve) => setTimeout(resolve, 2_500));
	}
}

/**
 * Funds every missing channel in one transaction from the operator's own sequence. Rare (after
 * this change ships and after a testnet reset); when two instances race, the loser's transaction
 * is refused, and it waits for the winner's channels instead (awaitAccount).
 */
async function createMissingChannels(
	server: rpc.Server,
	config: ServerConfig,
	operator: Keypair,
): Promise<void> {
	const channels = Array.from({ length: CHANNEL_COUNT }, (_, index) =>
		channelKeypair(operator, index),
	);
	const exists = await Promise.all(
		channels.map((channel) =>
			server.getAccount(channel.publicKey()).then(
				() => true,
				() => false,
			),
		),
	);
	const builder = new TransactionBuilder(await server.getAccount(operator.publicKey()), {
		fee: "10000",
		networkPassphrase: config.networkPassphrase,
	});
	channels.forEach((channel, index) => {
		if (exists[index]) return;
		builder.addOperation(
			Operation.createAccount({
				destination: channel.publicKey(),
				startingBalance: CHANNEL_STARTING_BALANCE,
			}),
		);
	});
	const tx = builder.setTimeout(30).build();
	tx.sign(operator);
	const sent = await server.sendTransaction(tx);
	if (sent.status === "PENDING") await server.pollTransaction(sent.hash, { attempts: 15 });
}
