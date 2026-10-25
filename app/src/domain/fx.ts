import type { Cents, Currency } from "./money.ts";

// Exchange rates are for display only: the headline total shows what every asset is worth in
// the home currency. The rules never use them (a payment in another currency takes the
// strictest tier until a live on-chain rate is wired). Rates are integers in micro-units
// (920_000 = 0.92) so conversions stay in integer arithmetic.

export const RATE_SCALE = 1_000_000;

export type Quote = {
	microRate: number;
	/** Where the rate comes from, for the label next to the amount. */
	label: string;
	/** True when the rate is a fixed stand-in, not a live quote. */
	simulated: boolean;
};

export type RateSource = {
	/** The quote from → to, or null when the source has none. */
	quote(from: Currency, to: Currency): Promise<Quote | null>;
};

export function convertCents(amount: Cents, microRate: number): Cents {
	return Math.round((amount * microRate) / RATE_SCALE);
}

/** "0.9200" for 920_000. */
export function formatRate(microRate: number): string {
	return (microRate / RATE_SCALE).toFixed(4);
}
