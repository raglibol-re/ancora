import { describe, expect, it } from "vitest";
import { dueMilestones } from "./dueDeals.js";

const deal = (id: number, status: string, milestones: [string, number][]) => ({
	id: BigInt(id),
	status: [status],
	objection_seconds: 100n,
	milestones: milestones.map(([state, at]) => ({ status: [state], requested_at: BigInt(at) })),
});

describe("dueMilestones", () => {
	it("finds requested milestones whose period has passed, once per deal", () => {
		const deals = [
			deal(1, "Active", [
				["Released", 0],
				["Requested", 900],
				["Requested", 950],
			]),
			// The same deal read through the other party's list.
			deal(1, "Active", [
				["Released", 0],
				["Requested", 900],
				["Requested", 950],
			]),
			deal(2, "Disputed", [["Requested", 0]]),
			deal(3, "Active", [["Objected", 0]]),
		];
		expect(dueMilestones(deals, 1_000)).toEqual([{ deal: 1, milestone: 1 }]);
		expect(dueMilestones(deals, 1_050)).toHaveLength(2);
	});
});
