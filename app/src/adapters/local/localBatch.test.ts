import { describe, expect, it } from "vitest";
import { SampleDataSource } from "../sample/sampleDataSource.ts";

const ORG = "tejo-rowing";

function source() {
	return new SampleDataSource(null, () => Date.UTC(2026, 9, 28, 12));
}

const account = (ds: SampleDataSource) => {
	const found = ds.getSnapshot().accounts.find((a) => a.org.id === ORG);
	if (!found) throw new Error("sample organization missing");
	return found;
};

describe("batch payments (sample data)", () => {
	it("requests several payments as one request judged on the total", async () => {
		const ds = source();
		const before = account(ds);
		const token = before.org.assets[0]?.token ?? "";
		const founder = before.org.founderId;
		const known = before.payees[0];
		if (!known) throw new Error("sample organization has no payees");
		const result = await ds.requestBatch(ORG, founder, {
			token,
			note: "Coaches, October",
			lines: [
				{ payee: { id: known.id }, amount: 15_000, note: "Ana" },
				{
					payee: { name: "", account: "PT50 0000 0000 0000 0000 9999 1" },
					amount: 15_000,
					note: "Rui",
				},
			],
		});
		expect(result.ok).toBe(true);
		const request = account(ds).requests.find((r) => result.ok && r.id === result.value);
		expect(request).toMatchObject({ kind: "batch", amount: 30_000, recipientIsNew: true });
		expect(request?.kind === "batch" && request.lines).toHaveLength(2);
		expect(account(ds).payees.some((p) => p.account === "PT50 0000 0000 0000 0000 9999 1")).toBe(
			true,
		);
	});

	it("refuses empty batches, zero lines and more than the account holds", async () => {
		const ds = source();
		const token = account(ds).org.assets[0]?.token ?? "";
		const founder = account(ds).org.founderId;
		const iban = { name: "", account: "PT50 1" };
		expect((await ds.requestBatch(ORG, founder, { token, note: "", lines: [] })).ok).toBe(false);
		expect(
			(
				await ds.requestBatch(ORG, founder, {
					token,
					note: "",
					lines: [{ payee: iban, amount: 0, note: "" }],
				})
			).ok,
		).toBe(false);
		expect(
			(
				await ds.requestBatch(ORG, founder, {
					token,
					note: "",
					lines: [{ payee: iban, amount: 1_000_000_000, note: "" }],
				})
			).ok,
		).toBe(false);
	});
});
