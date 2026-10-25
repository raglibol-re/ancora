import { useEffect, useMemo, useState } from "react";
import { frankfurterRates } from "../../adapters/fx/frankfurterRates.ts";
import { indicativeRates, withFallback } from "../../adapters/fx/indicativeRates.ts";
import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import type { Quote, RateSource } from "../../domain/fx.ts";
import type { Currency } from "../../domain/money.ts";

/** Quotes for every currency in `from` into `into`, keyed by the source currency. */
export function useFxRates(from: readonly Currency[], into: Currency) {
	const source: RateSource = useMemo(
		() =>
			testnetConfig?.fxRatesUrl
				? withFallback(frankfurterRates(testnetConfig.fxRatesUrl))
				: indicativeRates,
		[],
	);
	const wanted = [...new Set(from.filter((c) => c !== into))].sort().join(",");
	const [quotes, setQuotes] = useState<Readonly<Record<string, Quote>>>({});

	useEffect(() => {
		if (!wanted) return;
		let cancelled = false;
		void Promise.all(
			wanted.split(",").map(async (currency) => {
				const quote = await source.quote(currency as Currency, into);
				return quote ? ([currency, quote] as const) : null;
			}),
		).then((entries) => {
			if (cancelled) return;
			setQuotes(Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => e !== null)));
		});
		return () => {
			cancelled = true;
		};
	}, [source, wanted, into]);

	return quotes;
}
