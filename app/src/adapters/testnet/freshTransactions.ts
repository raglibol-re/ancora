import type { rpc } from "@stellar/stellar-sdk";

// The passkey kit asks the RPC for a transaction once, right after the relayer reported it
// confirmed. The public RPC's nodes aren't all at the same ledger, so one may not know it yet,
// and the kit then reported "The confirmed deployment transaction is unavailable" although the
// pass existed (E2E runs, 5–12 Nov 2026).

export const NOT_FOUND_RETRIES = 4;
export const NOT_FOUND_WAIT_MS = 750;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Makes `server` ask again for a few seconds before a transaction counts as "not found". */
export function askAgainForFreshTransactions(
	server: Pick<rpc.Server, "getTransaction">,
	wait: (ms: number) => Promise<void> = pause,
): void {
	const ask = server.getTransaction.bind(server);
	server.getTransaction = async (hash) => {
		let response = await ask(hash);
		for (let retry = 0; retry < NOT_FOUND_RETRIES && response.status === "NOT_FOUND"; retry++) {
			await wait(NOT_FOUND_WAIT_MS);
			response = await ask(hash);
		}
		return response;
	};
}
