import { type Quote, RATE_SCALE, type RateSource } from "../../domain/fx.ts";
import type { Currency } from "../../domain/money.ts";

// Fixed stand-in rates for sample data and for when no rate service is configured or
// reachable. Labeled "Simulated" wherever they show.

const TABLE: Readonly<Record<string, number>> = {
	"USD/EUR": 920_000,
	"EUR/USD": 1_087_000,
};

const LABEL = "fixed indicative rate";

export const indicativeRates: RateSource = {
	async quote(from: Currency, to: Currency): Promise<Quote | null> {
		if (from === to) return { microRate: RATE_SCALE, label: LABEL, simulated: true };
		const microRate = TABLE[`${from}/${to}`];
		return microRate === undefined ? null : { microRate, label: LABEL, simulated: true };
	},
};

/** Asks `primary` first and falls back to the fixed table, which marks its quotes simulated. */
export function withFallback(primary: RateSource): RateSource {
	return {
		async quote(from, to) {
			return (await primary.quote(from, to)) ?? indicativeRates.quote(from, to);
		},
	};
}
