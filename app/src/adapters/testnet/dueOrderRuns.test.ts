import { describe, expect, it } from "vitest";
import { type DueOrder, DueOrderRuns, ORDER_ATTEMPTS } from "./dueOrderRuns.ts";

const order: DueOrder = { orgId: "CORG", id: "1" };
const refused = async () => ({ ok: false as const, message: "The RPC didn't answer." });
const done = async () => ({ ok: true as const });

describe("running due standing orders", () => {
	it("tries a failed run again, a few times and no more", async () => {
		const runs = new DueOrderRuns();
		const failures: string[] = [];
		let calls = 0;
		for (let refresh = 0; refresh < ORDER_ATTEMPTS + 2; refresh++) {
			const ran = await runs.run(
				[order],
				() => {
					calls += 1;
					return refused();
				},
				(message) => failures.push(message),
			);
			expect(ran).toBe(false);
		}
		expect(calls).toBe(ORDER_ATTEMPTS);
		expect(failures).toHaveLength(ORDER_ATTEMPTS);
		expect(runs.canTry(order)).toBe(false);
	});

	it("says when an order ran, so the chain is read again", async () => {
		const runs = new DueOrderRuns();
		expect(await runs.run([order], refused, () => undefined)).toBe(false);
		expect(await runs.run([order], done, () => undefined)).toBe(true);
	});

	it("never runs an order twice at once", async () => {
		const runs = new DueOrderRuns();
		let calls = 0;
		let finish: (value: { ok: true }) => void = () => undefined;
		const slow = () => {
			calls += 1;
			return new Promise<{ ok: true }>((resolve) => {
				finish = resolve;
			});
		};
		const first = runs.run([order], slow, () => undefined);
		expect(await runs.run([order], slow, () => undefined)).toBe(false);
		finish({ ok: true });
		expect(await first).toBe(true);
		expect(calls).toBe(1);
	});

	it("keeps count per order", async () => {
		const runs = new DueOrderRuns();
		const other: DueOrder = { orgId: "CORG", id: "2" };
		for (let i = 0; i < ORDER_ATTEMPTS; i++) await runs.run([order], refused, () => undefined);
		const ran: string[] = [];
		await runs.run(
			[order, other],
			async (due) => {
				ran.push(due.id);
				return { ok: true };
			},
			() => undefined,
		);
		expect(ran).toEqual(["2"]);
	});
});
