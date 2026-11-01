import { xdr } from "@stellar/stellar-sdk";
import type { Currency } from "../../domain/money.ts";
import type { Allowance, FxRates, RecipientRule } from "../../domain/rules/model.ts";
import { type Network, readContract } from "./readContract.ts";
import { toCents } from "./scv.ts";

// The finer controls an organization keeps from interface 8 on (controls.rs): allowances per
// asset and category, the recipient allowlist, and exchange rates from its SEP-40 oracle.

type Native = Record<string, unknown>;

export type Controls = {
	/** Allowances by member address. */
	allowances: ReadonlyMap<string, Allowance[]>;
	recipients: RecipientRule;
	fx: FxRates | null;
};

const MODES: Record<string, RecipientRule["mode"]> = {
	Open: "open",
	Approve: "approve",
	Only: "only",
};

const nameOf = (value: unknown) => String(Array.isArray(value) ? value[0] : value);

export async function readControls(
	network: Network,
	contractId: string,
	currencies: readonly Currency[],
): Promise<Controls> {
	const [rows, rule, oracle] = await Promise.all([
		readContract(network, contractId, "allowances") as Promise<Native[]>,
		readContract(network, contractId, "recipient_rule") as Promise<Native>,
		readContract(network, contractId, "fx_oracle") as Promise<string | null>,
	]);
	const allowances = new Map<string, Allowance[]>();
	for (const row of rows) {
		const a = row.allowance as Native;
		const member = String(row.member);
		allowances.set(member, [
			...(allowances.get(member) ?? []),
			{
				token: a.token ? String(a.token) : null,
				category: a.category ? String(a.category) : null,
				amount: toCents(BigInt(a.amount as bigint)),
				periodSeconds: Number(a.period_seconds),
				spent: toCents(BigInt(a.spent as bigint)),
				windowStart: Number(a.window_start) * 1000,
			},
		]);
	}
	return {
		allowances,
		recipients: {
			mode: MODES[nameOf(rule.mode)] ?? "open",
			allowed: (rule.allowed as unknown[]).map(String),
		},
		fx: oracle ? await readRates(network, String(oracle), currencies) : null,
	};
}

/** Each currency's latest price at the oracle; a currency it doesn't quote is left out. */
async function readRates(
	network: Network,
	oracle: string,
	currencies: readonly Currency[],
): Promise<FxRates> {
	const quotes = await Promise.all(
		currencies.map((currency) =>
			readContract(network, oracle, "lastprice", [
				xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol(currency)]),
			]).catch(() => null),
		),
	);
	const prices: FxRates["prices"] = {};
	currencies.forEach((currency, index) => {
		const quote = quotes[index] as Native | null | undefined;
		if (quote) {
			prices[currency] = {
				price: BigInt(quote.price as bigint),
				at: Number(quote.timestamp) * 1000,
			};
		}
	});
	return { oracle, prices };
}
