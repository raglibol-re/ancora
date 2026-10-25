/**
 * Amounts are integer minor units (euro or dollar cents), never floats.
 * Formatting happens only at the UI edge; conversion to on-chain units (stroops) only in adapters.
 */
export type Cents = number;

/** Whole currency units to cents, for constants such as template limits. */
export const euros = (whole: number): Cents => whole * 100;

export function isValidAmount(amount: Cents): boolean {
	return Number.isSafeInteger(amount) && amount > 0;
}

/**
 * Parses what a person types ("1,250.50", "1250,5", "€ 80") into cents without going through
 * floating point. Returns null for anything that isn't a plain amount with at most two decimals.
 */
export function parseAmountInput(input: string): Cents | null {
	const cleaned = input.replace(/[€$\s]/g, "");
	const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);
	if (!match) return null;
	const whole = Number((match[1] ?? "").replaceAll(",", ""));
	const fraction = Number((match[2] ?? "").padEnd(2, "0"));
	const cents = whole * 100 + fraction;
	return isValidAmount(cents) ? cents : null;
}
