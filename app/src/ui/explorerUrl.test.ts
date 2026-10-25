import { describe, expect, it } from "vitest";
import { explorerUrl } from "./explorerUrl.ts";

const contract = `C${"A".repeat(55)}`;
const account = `G${"B".repeat(55)}`;

describe("explorerUrl", () => {
	it("links contracts, accounts and transactions", () => {
		expect(explorerUrl(contract)).toBe(
			`https://stellar.expert/explorer/testnet/contract/${contract}`,
		);
		expect(explorerUrl(account)).toBe(`https://stellar.expert/explorer/testnet/account/${account}`);
		expect(explorerUrl("ab12")).toBe("https://stellar.expert/explorer/testnet/tx/ab12");
	});
});
