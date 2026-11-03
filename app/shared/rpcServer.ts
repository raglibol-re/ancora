import { rpc } from "@stellar/stellar-sdk";

// Used by the browser (testnet adapter) and the Vercel Functions alike.

/**
 * The SDK waits on an RPC request forever by default, so one request the public testnet RPC
 * drops would keep a step on "Sending to Stellar…" for good. After this long it fails instead
 * and the person sees an error they can retry.
 */
export const RPC_TIMEOUT_MS = 30_000;

/** Gives up on any request to `server` after RPC_TIMEOUT_MS. */
export function withRpcTimeout(server: rpc.Server): rpc.Server {
	server.httpClient.defaults.timeout = RPC_TIMEOUT_MS;
	return server;
}

/** A Stellar RPC client whose requests time out (see RPC_TIMEOUT_MS). */
export function rpcServer(url: string): rpc.Server {
	return withRpcTimeout(new rpc.Server(url));
}
