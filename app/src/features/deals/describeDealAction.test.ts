import { describe, expect, it } from "vitest";
import { describeDealAction } from "./describeDealAction.ts";

describe("describeDealAction", () => {
	it("describes steps in plain language", () => {
		const label = () => "Hull";
		expect(describeDealAction({ type: "fund", dealId: 7 }, label)).toBe(
			"Deposit the amount for deal #7",
		);
		expect(describeDealAction({ type: "object", dealId: 7, milestone: 0 }, label)).toBe(
			'Object to the payout of "Hull"',
		);
	});
});
