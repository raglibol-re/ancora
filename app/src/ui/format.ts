import type { Currency } from "../domain/account.ts";
import type { Cents } from "../domain/money.ts";

// Formatting lives at the UI edge only; the domain works in integer cents and epoch milliseconds.

const LOCALE = "en-IE";

const formatters = {
	EUR: new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }),
	USD: new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD" }),
};

export function formatMoney(cents: Cents, currency: Currency = "EUR"): string {
	return formatters[currency].format(cents / 100);
}

/** "+€24.00" / "−€180.00" for signed amounts in lists. */
export function formatSignedMoney(cents: Cents, currency: Currency = "EUR"): string {
	if (cents === 0) return formatMoney(0, currency);
	return `${cents > 0 ? "+" : "−"}${formatMoney(Math.abs(cents), currency)}`;
}

export function formatRate(basisPoints: number): string {
	return `${(basisPoints / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2 })}%`;
}

const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(timestamp: number): string {
	return dateTime.format(timestamp);
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function formatRelative(timestamp: number, now: number): string {
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
