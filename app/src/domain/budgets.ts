import type { OrgAccount } from "./account.ts";
import type { Cents } from "./money.ts";
import { err, ok, type Result } from "./result.ts";
import type { Budget } from "./rules/model.ts";
import { type RuleError, ruleError } from "./rules/model.ts";

// Budgets are part of the rules: a spending envelope per category and rolling period in the
// home currency, enforced by the organization contract. A payment tagged with a category counts
// against it. Beyond the remaining amount a soft budget escalates the payment to the strictest
// tier and flags it; a hard budget refuses it. This module mirrors the contract's bookkeeping
// for sample data and previews; timestamps are ms.

/** What was booked against a budget in its running window. */
export type BudgetUse = {
	spent: Cents;
	windowStart: number;
};

export type BudgetLine = Budget & {
	spent: Cents;
	remaining: Cents;
	/** When the running window ends, ms. */
	windowEnd: number;
};

const CATEGORY = /^[a-z0-9][a-z0-9_]{0,31}$/;

/** Categories are contract symbols: lowercase letters, digits and underscores, up to 32. */
export function isCategory(value: string): boolean {
	return CATEGORY.test(value);
}

/** Cleans what someone typed into a category: "Boat Repairs" → "boat_repairs". */
export function toCategory(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^#/, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 32);
}

export const BUDGET_PERIODS: readonly { seconds: number; label: string }[] = [
	{ seconds: 7 * 86_400, label: "week" },
	{ seconds: 30 * 86_400, label: "30 days" },
	{ seconds: 90 * 86_400, label: "quarter" },
	{ seconds: 365 * 86_400, label: "year" },
];

export function describePeriod(seconds: number): string {
	return BUDGET_PERIODS.find((p) => p.seconds === seconds)?.label ?? `${seconds} s`;
}

/** The use with its window rolled forward to `now`, like the contract does on every read. */
export function currentBudgetUse(
	budget: Budget,
	use: BudgetUse | undefined,
	now: number,
): BudgetUse {
	if (!use || now >= use.windowStart + budget.periodSeconds * 1000) {
		return { spent: 0, windowStart: now };
	}
	return use;
}

export function budgetLine(budget: Budget, use: BudgetUse | undefined, now: number): BudgetLine {
	const current = currentBudgetUse(budget, use, now);
	return {
		...budget,
		spent: current.spent,
		remaining: budget.amount - current.spent,
		windowEnd: current.windowStart + budget.periodSeconds * 1000,
	};
}

export function budgetLines(account: OrgAccount, now: number): BudgetLine[] {
	return account.org.policy.budgets.map((budget) =>
		budgetLine(budget, account.budgetUse[budget.category], now),
	);
}

export type BudgetCheck =
	| { kind: "none" }
	| { kind: "within"; line: BudgetLine }
	| { kind: "over"; line: BudgetLine }
	| { kind: "refused"; line: BudgetLine }
	| { kind: "unknown"; category: string };

/**
 * What a payment of `amount` (home currency) against `category` would do, as the contract sees
 * it. `foreign` payments can't be measured: a hard budget refuses them, a soft one flags them.
 */
export function checkBudget(
	account: OrgAccount,
	category: string | null,
	amount: Cents,
	foreign: boolean,
	now: number,
): BudgetCheck {
	if (!category) return { kind: "none" };
	const budget = account.org.policy.budgets.find((b) => b.category === category);
	if (!budget) return { kind: "unknown", category };
	const line = budgetLine(budget, account.budgetUse[category], now);
	if (!foreign && amount <= Math.max(0, line.remaining)) return { kind: "within", line };
	return { kind: budget.hard ? "refused" : "over", line };
}

/** The contract's refusals for a payment, as typed errors; `ok` carries the over-budget flag. */
export function budgetVerdict(check: BudgetCheck): Result<boolean, RuleError> {
	switch (check.kind) {
		case "none":
		case "within":
			return ok(false);
		case "over":
			return ok(true);
		case "refused":
			return err(
				ruleError(
					"budget-exceeded",
					`This goes beyond what is left of the ${check.line.category} budget this ${describePeriod(check.line.periodSeconds)}; it is a hard budget, so the payment isn't accepted.`,
				),
			);
		case "unknown":
			return err(ruleError("unknown-budget", `The rules have no budget called ${check.category}.`));
	}
}

/** Books a home-currency payment against its budget (the contract does the same). */
export function bookBudget(
	account: OrgAccount,
	category: string,
	amount: Cents,
	now: number,
): OrgAccount["budgetUse"] {
	const budget = account.org.policy.budgets.find((b) => b.category === category);
	if (!budget) return account.budgetUse;
	const current = currentBudgetUse(budget, account.budgetUse[category], now);
	return { ...account.budgetUse, [category]: { ...current, spent: current.spent + amount } };
}

/** Gives a declined payment's amount back, within the running window. */
export function releaseBudget(
	account: OrgAccount,
	category: string,
	amount: Cents,
	now: number,
): OrgAccount["budgetUse"] {
	const budget = account.org.policy.budgets.find((b) => b.category === category);
	if (!budget) return account.budgetUse;
	const current = currentBudgetUse(budget, account.budgetUse[category], now);
	return {
		...account.budgetUse,
		[category]: { ...current, spent: Math.max(0, current.spent - amount) },
	};
}

/** Adds or replaces one budget in a list; an amount of 0 removes it. */
export function upsertBudget(budgets: readonly Budget[], budget: Budget): Budget[] {
	const rest = budgets.filter((b) => b.category !== budget.category);
	return budget.amount > 0
		? [...rest, budget].sort((a, b) => a.category.localeCompare(b.category))
		: rest;
}
