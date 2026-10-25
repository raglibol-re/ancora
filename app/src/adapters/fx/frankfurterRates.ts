import { type Quote, RATE_SCALE, type RateSource } from "../../domain/fx.ts";
import type { Currency } from "../../domain/money.ts";

// Reference rates from the ECB through the Frankfurter API (no key, CORS enabled). The base URL
// comes from config so another provider or a self-hosted mirror is one setting away.

const CACHE_MS = 10 * 60_000;
const LABEL = "ECB reference rate";

export function frankfurterRates(baseUrl: string): RateSource {
	const cache = new Map<string, { quote: Quote; at: number }>();
	return {
		async quote(from: Currency, to: Currency): Promise<Quote | null> {
			if (from === to) return { microRate: RATE_SCALE, label: LABEL, simulated: false };
			const key = `${from}/${to}`;
			const cached = cache.get(key);
			if (cached && Date.now() - cached.at < CACHE_MS) return cached.quote;
			const response = await fetch(
				`${baseUrl.replace(/\/$/, "")}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
			).catch(() => null);
			if (!response?.ok) return null;
			const body = (await response.json().catch(() => null)) as {
				rates?: Record<string, number>;
			} | null;
			const value = body?.rates?.[to];
			if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
			const quote = { microRate: Math.round(value * RATE_SCALE), label: LABEL, simulated: false };
			cache.set(key, { quote, at: Date.now() });
			return quote;
		},
	};
}
