import { describe, expect, it } from "vitest";
import type { OrgAccount } from "../../domain/account.ts";
import { SampleDataSource } from "../sample/sampleDataSource.ts";

const start = Date.UTC(2026, 9, 25, 12);
const ORG = "tejo-rowing";
const DAY = 86_400_000;

function source() {
	let now = start;
	const ds = new SampleDataSource(null, () => now);
	return { ds, advance: (ms: number) => (now += ms) };
}

function account(ds: SampleDataSource): OrgAccount {
	const found = ds.getSnapshot().accounts.find((a) => a.org.id === ORG);
	if (!found) throw new Error("sample organization missing");
	return found;
}

/** The first member below the top role, another one, and a holder of the top role. */
function people(acc: OrgAccount) {
	const top = acc.org.roles[0]?.id;
	const owner = acc.org.members.find((m) => m.roleId !== top);
	const other = acc.org.members.find((m) => m.roleId !== top && m !== owner);
	const boss = acc.org.members.find((m) => m.roleId === top);
	if (!owner || !other || !boss) throw new Error("sample organization needs three members");
	return { owner: owner.personId, other: other.personId, boss: boss.personId };
}

const order = (token: string, firstAt: number) => ({
	to: "PT50 0000 0000 0000 0000 7788 1",
	token,
	amount: 5_000,
	note: "Coaching",
	category: null,
	intervalSeconds: 30 * 86_400,
	firstAt,
});

describe("standing orders (sample data)", () => {
	it("sets an order, runs it at once as a payment request and moves the next date on", async () => {
		const { ds } = source();
		const before = account(ds);
		const { owner } = people(before);
		const token = before.org.assets[0]?.token ?? "";
		const set = await ds.setStandingOrder(ORG, owner, order(token, start));
		expect(set.ok).toBe(true);
		const after = account(ds);
		const created = after.standingOrders?.[0];
		expect(created).toMatchObject({ active: true, runs: 1, amount: 5_000, by: owner });
		expect(created?.nextAt).toBe(start + 30 * DAY);
		expect(after.requests.some((r) => r.id === created?.lastRequestId)).toBe(true);
		expect(after.standingOrders?.length).toBe((before.standingOrders?.length ?? 0) + 1);
	});

	it("runs only when due and stops only for its owner or the top role", async () => {
		const { ds, advance } = source();
		const before = account(ds);
		const { owner, other, boss } = people(before);
		const token = before.org.assets[0]?.token ?? "";
		await ds.setStandingOrder(ORG, owner, order(token, start + DAY));
		const id = account(ds).standingOrders?.[0]?.id ?? "";
		expect(account(ds).standingOrders?.[0]?.runs).toBe(0);
		expect((await ds.runStandingOrder(ORG, id)).ok).toBe(false);
		advance(95 * DAY);
		expect((await ds.runStandingOrder(ORG, id)).ok).toBe(true);
		const run = account(ds).standingOrders?.[0];
		expect(run?.runs).toBe(1);
		// Missed runs are skipped: the next date lands after now.
		expect(run?.nextAt).toBe(start + 121 * DAY);
		expect((await ds.cancelStandingOrder(ORG, other, id)).ok).toBe(false);
		expect((await ds.cancelStandingOrder(ORG, boss, id)).ok).toBe(true);
		expect(account(ds).standingOrders?.[0]?.active).toBe(false);
		expect((await ds.runStandingOrder(ORG, id)).ok).toBe(false);
	});
});
