import { describe, expect, it } from "vitest";
import { SampleDataSource } from "../sample/sampleDataSource.ts";

const ORG = "tejo-rowing";

describe("payment links (sample data)", () => {
	it("creates a link for several payers and closes it", async () => {
		const ds = new SampleDataSource(null, () => Date.UTC(2026, 9, 28, 12));
		const account = () => ds.getSnapshot().accounts.find((a) => a.org.id === ORG);
		const founder = account()?.org.founderId ?? "";
		const token = account()?.org.assets[0]?.token ?? "";
		const created = await ds.createLink(ORG, founder, {
			token,
			amount: 3_000,
			note: "Membership 2027",
			maxPayments: 40,
		});
		expect(created.ok).toBe(true);
		const link = account()?.paymentLinks?.[0];
		expect(link).toMatchObject({ memo: "Membership 2027", maxPayments: 40, open: true });
		expect((await ds.closeLink(ORG, founder, link?.id ?? "")).ok).toBe(true);
		expect(account()?.paymentLinks?.[0]?.open).toBe(false);
	});

	it("refuses strangers, zero amounts and impossible counts", async () => {
		const ds = new SampleDataSource(null, () => Date.UTC(2026, 9, 28, 12));
		const account = ds.getSnapshot().accounts.find((a) => a.org.id === ORG);
		const founder = account?.org.founderId ?? "";
		const token = account?.org.assets[0]?.token ?? "";
		const input = { token, amount: 100, note: "x", maxPayments: 1 };
		expect((await ds.createLink(ORG, "stranger", input)).ok).toBe(false);
		expect((await ds.createLink(ORG, founder, { ...input, amount: 0 })).ok).toBe(false);
		expect((await ds.createLink(ORG, founder, { ...input, maxPayments: 501 })).ok).toBe(false);
	});
});
