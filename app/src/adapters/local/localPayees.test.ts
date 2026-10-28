import { describe, expect, it } from "vitest";
import { SampleDataSource } from "../sample/sampleDataSource.ts";

const ORG = "tejo-rowing";
const IBAN = "PT50 0000 0000 0000 0000 1234 5";

function source() {
	return new SampleDataSource(null, () => Date.UTC(2026, 9, 28, 12));
}

const book = (ds: SampleDataSource) =>
	ds.getSnapshot().accounts.find((a) => a.org.id === ORG)?.payees ?? [];

describe("address book (sample data)", () => {
	it("saves, renames and removes a recipient", async () => {
		const ds = source();
		const member = ds.getSnapshot().accounts.find((a) => a.org.id === ORG)?.org.members[0];
		if (!member) throw new Error("sample organization has no members");
		const before = book(ds).length;
		const saved = await ds.savePayee(ORG, member.personId, {
			account: IBAN,
			name: "Rowing Federation",
			note: "Annual fee",
		});
		expect(saved.ok).toBe(true);
		expect(book(ds).find((p) => p.account === IBAN)).toMatchObject({
			name: "Rowing Federation",
			saved: true,
			note: "Annual fee",
			savedBy: member.personId,
		});
		await ds.savePayee(ORG, member.personId, { account: IBAN, name: "Federação", note: "" });
		expect(book(ds).filter((p) => p.account === IBAN)).toHaveLength(1);
		expect(book(ds).find((p) => p.account === IBAN)?.name).toBe("Federação");
		expect((await ds.removePayee(ORG, member.personId, IBAN)).ok).toBe(true);
		expect(book(ds).find((p) => p.account === IBAN)?.saved).toBeFalsy();
		expect(book(ds).length).toBe(before + 1);
	});

	it("refuses strangers and nameless entries", async () => {
		const ds = source();
		expect((await ds.savePayee(ORG, "stranger", { account: IBAN, name: "X", note: "" })).ok).toBe(
			false,
		);
		const member = ds.getSnapshot().accounts.find((a) => a.org.id === ORG)?.org.members[0];
		if (!member) throw new Error("sample organization has no members");
		expect(
			(await ds.savePayee(ORG, member.personId, { account: IBAN, name: " ", note: "" })).ok,
		).toBe(false);
	});
});
