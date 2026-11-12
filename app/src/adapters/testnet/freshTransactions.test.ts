import type { rpc } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { askAgainForFreshTransactions, NOT_FOUND_RETRIES } from "./freshTransactions.ts";

type Answer = rpc.Api.GetTransactionResponse;
const answer = (status: string) => ({ status }) as unknown as Answer;

/** An RPC that gives the listed answers in turn, then keeps giving the last one. */
function rpcAnswering(statuses: string[]) {
	let asked = 0;
	const server = {
		getTransaction: async (_hash: string) => {
			const status = statuses[Math.min(asked, statuses.length - 1)] ?? "NOT_FOUND";
			asked += 1;
			return answer(status);
		},
	};
	askAgainForFreshTransactions(server, async () => undefined);
	return { server, asked: () => asked };
}

describe("asking the RPC for a transaction that was just confirmed", () => {
	it("asks again while a lagging node doesn't know it yet", async () => {
		const { server, asked } = rpcAnswering(["NOT_FOUND", "NOT_FOUND", "SUCCESS"]);
		expect((await server.getTransaction("abc")).status).toBe("SUCCESS");
		expect(asked()).toBe(3);
	});

	it("takes any other answer at once", async () => {
		for (const status of ["SUCCESS", "FAILED"]) {
			const { server, asked } = rpcAnswering([status]);
			expect((await server.getTransaction("abc")).status).toBe(status);
			expect(asked()).toBe(1);
		}
	});

	it("gives up after a few tries", async () => {
		const { server, asked } = rpcAnswering(["NOT_FOUND"]);
		expect((await server.getTransaction("abc")).status).toBe("NOT_FOUND");
		expect(asked()).toBe(NOT_FOUND_RETRIES + 1);
	});
});
