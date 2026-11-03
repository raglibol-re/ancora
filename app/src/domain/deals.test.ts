import { describe, expect, it } from "vitest";
import { type Deal, payoutAt, sideOf, stepsFor } from "./deals.ts";

const HOUR = 3_600_000;

function deal(overrides: Partial<Deal> = {}): Deal {
	return {
		id: 7,
		partyA: "CA",
		partyB: "CB",
		token: "eurc",
		milestones: [
			{ label: "Hull", amount: 60_000, status: "open", requestedAt: null },
			{ label: "Rigging", amount: 40_000, status: "open", requestedAt: null },
		],
		objectionSeconds: 3 * 86_400,
		arbiter: null,
		documentHash: "ab".repeat(32),
		status: "draft",
		total: 100_000,
		paidOut: 0,
		createdAt: 0,
		cancelAsks: [],
		...overrides,
	};
}

const types = (d: Deal, side: "a" | "b" | null, now = 0) =>
	stepsFor(d, side, now).map((step) => step.action.type);

describe("deal steps", () => {
	it("follow the lifecycle: B accepts, A deposits, B asks, A approves or objects", () => {
		expect(types(deal(), "b")).toEqual(["accept"]);
		expect(types(deal(), "a")).toEqual(["cancel"]);
		expect(types(deal({ status: "accepted" }), "a")).toEqual(["fund", "cancel"]);
		expect(types(deal({ status: "funded" }), "b")).toEqual([
			"requestRelease",
			"requestRelease",
			"cancel",
		]);
		const requested = deal({
			status: "active",
			milestones: [
				{ label: "Hull", amount: 60_000, status: "requested", requestedAt: 0 },
				{ label: "Rigging", amount: 40_000, status: "open", requestedAt: null },
			],
		});
		expect(types(requested, "a", HOUR)).toEqual(["approveRelease", "object", "cancel"]);
		// Once the period has passed, anyone may trigger the payout; A can no longer object.
		expect(types(requested, "a", 4 * 86_400_000)).toEqual([
			"approveRelease",
			"releaseNow",
			"cancel",
		]);
		expect(types(requested, null, 4 * 86_400_000)).toEqual(["releaseNow"]);
	});

	it("offer a dispute only with an arbiter, and a cancellation once per party", () => {
		const funded = deal({ status: "funded", arbiter: "CJ", cancelAsks: ["CA"] });
		expect(types(funded, "a")).toEqual(["dispute"]);
		expect(types(funded, "b")).toContain("cancel");
		expect(types(deal({ status: "completed" }), "a")).toEqual([]);
	});

	it("know each side and the automatic payout time", () => {
		const d = deal();
		expect(sideOf(d, "CB")).toBe("b");
		expect(sideOf(d, "CX")).toBeNull();
		const milestone = { label: "Hull", amount: 1, status: "requested" as const, requestedAt: HOUR };
		expect(payoutAt(d, milestone)).toBe(HOUR + 3 * 86_400_000);
	});
});
