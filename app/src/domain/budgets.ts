import type { OrgAccount } from "./account.ts";
import type { Cents } from "./money.ts";

// Budgets are plans, not rules: a monthly amount per category in the organization's home
// currency. Spend is read from executed payments whose reference carries the category as a
// hashtag ("Oars #equipment"), so the books stay on-chain and nothing is enforced here; the
// approval rules do that.

export type Budget = {
	/** Lowercase tag without the "#": letters, digits and dashes. */
	category: string;
	/** Per calendar month, in the organization's home currency. */
	amount: Cents;
};

export type BudgetLine = Budget & {
	spent: Cents;
	remaining: Cents;
};

export type BudgetReport = {
	lines: readonly BudgetLine[];
	/** Executed this month in the home currency without a budgeted category. */
	uncategorized: Cents;
	/** Payments this month in another currency, which the report can't add up. */
	otherCurrency: number;
	monthLabel: string;
};

const CATEGORY = /^[a-z0-9][a-z0-9-]{0,23}$/;

export function isCategory(value: string): boolean {
	return CATEGORY.test(value);
}

/** Cleans what someone typed into a category: "Boat Repairs" → "boat-repairs". */
export function toCategory(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^#/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24);
}

/** The first hashtag in a payment reference, or null. */
export function categoryOf(note: string): string | null {
	const match = /(?:^|\s)#([a-z0-9][a-z0-9-]*)/i.exec(note);
	return match?.[1] ? match[1].toLowerCase() : null;
}

/** Appends the category tag to a reference unless it is already there. */
export function withCategory(note: string, category: string | null): string {
	const trimmed = note.trim();
	if (!category || categoryOf(trimmed) === category) return trimmed;
	return trimmed ? `${trimmed} #${category}` : `#${category}`;
}

function sameMonth(a: number, b: number): boolean {
	const da = new Date(a);
	const db = new Date(b);
	return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

/** Budgets against this month's executed payments in the home currency. */
export function budgetReport(account: OrgAccount, now: number): BudgetReport {
	const spentBy = new Map<string, Cents>();
	let uncategorized = 0;
	let otherCurrency = 0;
	for (const request of account.requests) {
		if (request.kind !== "payment" || request.status !== "executed") continue;
		if (!sameMonth(request.createdAt, now)) continue;
		if (request.currency !== account.org.baseCurrency) {
			otherCurrency += 1;
			continue;
		}
		const category = categoryOf(request.note);
		if (category && account.budgets.some((b) => b.category === category)) {
			spentBy.set(category, (spentBy.get(category) ?? 0) + request.amount);
		} else {
			uncategorized += request.amount;
		}
	}
	const lines = account.budgets.map((budget) => {
		const spent = spentBy.get(budget.category) ?? 0;
		return { ...budget, spent, remaining: budget.amount - spent };
	});
	return {
		lines,
		uncategorized,
		otherCurrency,
		monthLabel: new Date(now).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
	};
}

/** Adds or replaces one budget; an amount of 0 removes it. */
export function upsertBudget(budgets: readonly Budget[], budget: Budget): Budget[] {
	const rest = budgets.filter((b) => b.category !== budget.category);
	return budget.amount > 0
		? [...rest, budget].sort((a, b) => a.category.localeCompare(b.category))
		: rest;
}
