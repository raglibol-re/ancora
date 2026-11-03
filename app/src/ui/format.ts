import type { Cents, Currency } from "../domain/money.ts";
import { currentLanguage, FORMAT_LOCALE } from "./i18n.ts";

// Formatting lives at the UI edge only; the domain works in integer cents and epoch milliseconds.
// Numbers, money and dates follow the language the person picked (i18n.ts).

const locale = () => FORMAT_LOCALE[currentLanguage()];

/** One formatter per locale and kind, made on first use. */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
	kind: string,
	make: (locale: string) => T,
): T {
	const key = `${locale()}:${kind}`;
	let formatter = cache.get(key) as T | undefined;
	if (!formatter) {
		formatter = make(locale());
		cache.set(key, formatter);
	}
	return formatter;
}

export function formatMoney(cents: Cents, currency: Currency = "EUR"): string {
	return cached(currency, (l) => new Intl.NumberFormat(l, { style: "currency", currency })).format(
		cents / 100,
	);
}

/** "+€24.00" / "−€180.00" for signed amounts in lists. */
export function formatSignedMoney(cents: Cents, currency: Currency = "EUR"): string {
	if (cents === 0) return formatMoney(0, currency);
	return `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents), currency)}`;
}

/** On-chain token amounts (7-decimal stroops) for operator views: "9,853.50 XLM". */
export function formatStroops(stroops: string, symbol: string): string {
	const whole = Number(BigInt(stroops) / 10_000_000n);
	const fraction = Number((BigInt(stroops) % 10_000_000n) / 100_000n);
	return `${whole.toLocaleString(locale())}.${String(fraction).padStart(2, "0")} ${symbol}`;
}

/** "€" / "$" for input labels. */
export function currencySymbol(currency: Currency): string {
	return currency === "EUR" ? "€" : "$";
}

export function formatRate(basisPoints: number): string {
	return `${(basisPoints / 100).toLocaleString(locale(), { minimumFractionDigits: 2 })}%`;
}

export function formatDateTime(timestamp: number): string {
	return cached(
		"dateTime",
		(l) => new Intl.DateTimeFormat(l, { dateStyle: "medium", timeStyle: "short" }),
	).format(timestamp);
}

export function formatRelative(timestamp: number, now: number): string {
	const relative = cached("relative", (l) => new Intl.RelativeTimeFormat(l, { numeric: "auto" }));
	const minutes = Math.round((timestamp - now) / 60_000);
	if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 48) return relative.format(hours, "hour");
	return relative.format(Math.round(hours / 24), "day");
}

/** Up to two initials for avatars ("Tejo Rowing Club" → "TR"). */
export function initials(name: string): string {
	const letters = name
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word[0]?.toUpperCase() ?? "");
	return letters.slice(0, 2).join("") || "?";
}
