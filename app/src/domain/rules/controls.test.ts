import { describe, expect, it } from "vitest";
import { euros } from "../money.ts";
import { evaluateProposal, pickAllowance, recipientVerdict, tierAmount } from "./controls.ts";
import type { Member, Org } from "./model.ts";
import { club } from "./testOrgs.ts";

const NOW = 1_000_000_000;
const ONE = 100_000_000_000_000n;

function withUsd(org: Org): Org {
	return { ...org, assets: [...org.assets, { token: "usdc", symbol: "USDC", currency: "USD" }] };
}

const member: Member = {
	personId: "max",
	roleId: "board",
	limit: { amount: euros(1_000), periodSeconds: 86_400, spent: 0, windowStart: NOW },
	allowances: [
		{
			token: "usdc",
			category: null,
			amount: euros(100),
			periodSeconds: 86_400,
			spent: 0,
			windowStart: NOW,
		},
		{
			token: null,
			category: "gear",
			amount: euros(300),
			periodSeconds: 86_400,
			spent: 0,
			windowStart: NOW,
		},
	],
};

describe("recipient allowlist", () => {
	it("passes everyone when open, escalates or refuses the unlisted otherwise", () => {
		const org = club();
		expect(recipientVerdict(org, "x")).toBe("ok");
		const approve = { ...org, recipients: { mode: "approve" as const, allowed: ["a"] } };
		expect(recipientVerdict(approve, "a")).toBe("ok");
		expect(recipientVerdict(approve, "b")).toBe("escalate");
		expect(
			recipientVerdict({ ...approve, recipients: { mode: "only", allowed: ["a"] } }, "b"),
		).toBe("refused");
	});
});

describe("tier amounts", () => {
	it("convert at a fresh rate, rounding up, and give up on stale or missing rates", () => {
		const org = withUsd(club());
		expect(tierAmount(org, "usdc", euros(110), NOW)).toBeNull();
		const fx = {
			oracle: "CO",
			prices: { EUR: { price: (ONE * 11n) / 10n, at: NOW }, USD: { price: ONE, at: NOW } },
		};
		// 110 USD at 1.10 USD per EUR is exactly 100 EUR; 1 cent more rounds up.
		expect(tierAmount({ ...org, fx }, "usdc", euros(110), NOW)).toBe(euros(100));
		expect(tierAmount({ ...org, fx }, "usdc", euros(110) + 1, NOW)).toBe(euros(100) + 1);
		expect(tierAmount({ ...org, fx }, "usdc", euros(110), NOW + 5 * 86_400_000)).toBeNull();
	});
});

describe("allowances", () => {
	it("use the most specific allowance with room, then the general limit", () => {
		expect(
			pickAllowance(
				member,
				{ token: "usdc", category: null, amount: euros(50), amountInBase: null },
				NOW,
			),
		).toEqual({ kind: "allowance", index: 0, counted: euros(50) });
		expect(
			pickAllowance(
				member,
				{ token: "eurc", category: "gear", amount: euros(200), amountInBase: euros(200) },
				NOW,
			),
		).toEqual({ kind: "allowance", index: 1, counted: euros(200) });
		expect(
			pickAllowance(
				member,
				{ token: "eurc", category: "gear", amount: euros(500), amountInBase: euros(500) },
				NOW,
			),
		).toEqual({ kind: "limit" });
		expect(
			pickAllowance(
				member,
				{ token: "usdc", category: null, amount: euros(500), amountInBase: null },
				NOW,
			),
		).toEqual({ kind: "none" });
	});

	it("never cover a recipient outside an approve allowlist", () => {
		const base = club();
		const org: Org = {
			...base,
			members: base.members.map((m) => (m.personId === "max" ? member : m)),
			recipients: { mode: "approve", allowed: [] },
		};
		const proposal = evaluateProposal(
			org,
			{
				requesterId: "max",
				token: base.assets[0]?.token ?? "",
				amount: euros(10),
				category: null,
				recipients: ["anyone"],
				recipientIsNew: false,
				overBudget: false,
			},
			NOW,
		);
		expect(proposal.kind === "ok" && proposal.use.kind).toBe("none");
		expect(proposal.kind === "ok" && proposal.evaluation.tierIndex).toBe(
			org.policy.tiers.length - 1,
		);
	});
});
