import type { Cents } from "../money.ts";
import type { Member, Org, PersonId, SpendingLimit } from "./model.ts";

// Crew and agent allowances: up to `amount` per rolling period goes out without approvals.
// Mirrors the organization contract (`use_limit`, `current_window`); timestamps here are ms.

export const LIMIT_PERIODS: readonly { seconds: number; label: string }[] = [
	{ seconds: 86_400, label: "day" },
	{ seconds: 7 * 86_400, label: "week" },
	{ seconds: 30 * 86_400, label: "30 days" },
];

export function periodLabel(seconds: number): string {
	return LIMIT_PERIODS.find((p) => p.seconds === seconds)?.label ?? `${seconds} s`;
}

/** The limit with its window rolled forward to `now`: spent resets once a period has passed. */
export function currentWindow(limit: SpendingLimit, now: number): SpendingLimit {
	return now >= limit.windowStart + limit.periodSeconds * 1000
		? { ...limit, spent: 0, windowStart: now }
		: limit;
}

export function remainingAllowance(limit: SpendingLimit, now: number): Cents {
	return Math.max(0, limit.amount - currentWindow(limit, now).spent);
}

export function fitsLimit(member: Member | undefined, amount: Cents, now: number): boolean {
	return member?.limit !== undefined && remainingAllowance(member.limit, now) >= amount;
}

/** Books a payment that went out inside the member's limit. */
export function bookLimit(org: Org, personId: PersonId, amount: Cents, now: number): Org {
	return {
		...org,
		members: org.members.map((m) => {
			if (m.personId !== personId || !m.limit) return m;
			const window = currentWindow(m.limit, now);
			return { ...m, limit: { ...window, spent: window.spent + amount } };
		}),
	};
}
