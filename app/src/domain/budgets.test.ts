import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../adapters/sample/seedWorkspace.ts";
import {
	bookBudget,
	budgetLines,
	budgetVerdict,
	checkBudget,
	releaseBudget,
	toCategory,
	upsertBudget,
} from "./budgets.ts";
import { euros } from "./money.ts";

const now = Date.UTC(2026, 9, 25, 12);

function club() {
	const account = seedWorkspace(now).accounts.find((a) => a.org.id === "tejo-rowing");
	if (!account) throw new Error("sample club missing");
	return account;
}

describe("budget categories", () => {
	it("cleans typed names into contract-safe categories", () => {
		expect(toCategory(" Boat Repairs ")).toBe("boat_repairs");
		expect(toCategory("#Travel!")).toBe("travel");
	});

	it("upserts and removes budgets by category", () => {
		const one = upsertBudget([], {
			category: "events",
			amount: euros(100),
			periodSeconds: 1,
			hard: false,
		});
		const two = upsertBudget(one, {
			category: "travel",
			amount: euros(50),
			periodSeconds: 1,
			hard: true,
		});
		expect(two.map((b) => b.category)).toEqual(["events", "travel"]);
		expect(
			upsertBudget(two, { category: "events", amount: 0, periodSeconds: 1, hard: false }),
		).toEqual([{ category: "travel", amount: euros(50), periodSeconds: 1, hard: true }]);
	});
});

describe("budget lines and checks", () => {
	it("reads the seeded use and rolls the window forward", () => {
		const account = club();
		const equipment = budgetLines(account, now).find((l) => l.category === "equipment");
		expect(equipment).toMatchObject({ amount: euros(1_500), spent: euros(640) });
		expect(equipment?.remaining).toBe(euros(860));
		const later = budgetLines(account, now + 31 * 86_400_000).find(
			(l) => l.category === "equipment",
		);
		expect(later?.spent).toBe(0);
	});

	it("decides within, over and refused like the contract", () => {
		const account = club();
		expect(checkBudget(account, null, euros(10), false, now).kind).toBe("none");
		expect(checkBudget(account, "nope", euros(10), false, now).kind).toBe("unknown");
		expect(checkBudget(account, "equipment", euros(860), false, now).kind).toBe("within");
		expect(checkBudget(account, "equipment", euros(861), false, now).kind).toBe("over");
		expect(checkBudget(account, "travel", euros(601), false, now).kind).toBe("refused");
		// Another currency can't be measured: soft flags, hard refuses.
		expect(checkBudget(account, "equipment", euros(1), true, now).kind).toBe("over");
		expect(checkBudget(account, "travel", euros(1), true, now).kind).toBe("refused");
		const [firstLine] = budgetLines(account, now);
		expect(firstLine && budgetVerdict({ kind: "over", line: firstLine })).toEqual({
			ok: true,
			value: true,
		});
		expect(budgetVerdict(checkBudget(account, "travel", euros(601), false, now)).ok).toBe(false);
	});

	it("books and releases within the running window", () => {
		const account = club();
		const booked = bookBudget(account, "equipment", euros(100), now);
		expect(booked.equipment?.spent).toBe(euros(740));
		const released = releaseBudget({ ...account, budgetUse: booked }, "equipment", euros(740), now);
		expect(released.equipment?.spent).toBe(0);
	});
});
