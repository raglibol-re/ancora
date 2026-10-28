import { describe, expect, it } from "vitest";
import { isSubscription } from "./pushStore.js";

describe("push subscriptions", () => {
	it("accepts what browsers send and nothing else", () => {
		const good = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } };
		expect(isSubscription(good)).toBe(true);
		expect(isSubscription({ ...good, endpoint: "http://push.example/abc" })).toBe(false);
		expect(isSubscription({ endpoint: good.endpoint })).toBe(false);
		expect(isSubscription(null)).toBe(false);
	});
});
