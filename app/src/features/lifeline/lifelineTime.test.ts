import { describe, expect, it } from "vitest";
import { describeTimeLeft, describeWait } from "./lifelineTime.ts";

describe("Lifeline times", () => {
	it("name the waiting period", () => {
		expect(describeWait(7 * 86_400)).toBe("7 days");
		expect(describeWait(120)).toBe("2 minutes");
		expect(describeWait(3 * 3_600)).toBe("3 hours");
	});

	it("say how long is left", () => {
		expect(describeTimeLeft(0)).toBe("now");
		expect(describeTimeLeft(118 * 60_000)).toBe("in 1 h 58 min");
		expect(describeTimeLeft(3 * 86_400_000)).toBe("in 3 days");
	});
});
