import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../adapters/sample/seedWorkspace.ts";
import { budgetReport, categoryOf, toCategory, upsertBudget, withCategory } from "./budgets.ts";
import { euros } from "./money.ts";

const now = Date.UTC(2026, 9, 25, 12);

function club() {
	const account = seedWorkspace(now).accounts.find((a) => a.org.id === "tejo-rowing");
	if (!account) throw new Error("sample club missing");
	return account;
}

describe("budget categories", () => {
	it("reads the first hashtag of a reference, case-insensitively", () => {
		expect(categoryOf("Oars #Equipment and more #travel")).toBe("equipment");
		expect(categoryOf("#events")).toBe("events");
		expect(categoryOf("no tag here")).toBeNull();
		expect(categoryOf("email#notatag")).toBeNull();
	});

	it("cleans typed names into categories", () => {
		expect(toCategory(" Boat Repairs ")).toBe("boat-repairs");
		expect(toCategory("#Travel!")).toBe("travel");
	});

	it("appends the tag once", () => {
		expect(withCategory("Oars", "equipment")).toBe("Oars #equipment");
		expect(withCategory("Oars #equipment", "equipment")).toBe("Oars #equipment");
		expect(withCategory("", "events")).toBe("#events");
		expect(withCategory("Oars ", null)).toBe("Oars");
	});
});

describe("budget report", () => {
	it("adds up this month's executed payments per category in the home currency", () => {
		const report = budgetReport(club(), now);
		const equipment = report.lines.find((l) => l.category === "equipment");
		expect(equipment).toMatchObject({ amount: euros(1_500), spent: euros(640) });
		expect(equipment?.remaining).toBe(euros(860));
		expect(report.lines.find((l) => l.category === "events")?.spent).toBe(0);
		expect(report.uncategorized).toBe(0);
	});

	it("ignores pending payments and other months", () => {
		const account = club();
		const executed = account.requests.filter(
			(r) => r.kind === "payment" && r.status === "executed",
		);
		expect(executed.length).toBeGreaterThan(0);
		const nextMonth = Date.UTC(2026, 10, 15);
		expect(budgetReport(account, nextMonth).lines.every((l) => l.spent === 0)).toBe(true);
	});

	it("upserts and removes budgets by category", () => {
		const one = upsertBudget([], { category: "events", amount: euros(100) });
		const two = upsertBudget(one, { category: "travel", amount: euros(50) });
		expect(two.map((b) => b.category)).toEqual(["events", "travel"]);
		expect(upsertBudget(two, { category: "events", amount: 0 })).toEqual([
			{ category: "travel", amount: euros(50) },
		]);
	});
});
