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
