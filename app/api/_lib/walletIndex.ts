import type { WalletBirth } from "./walletBirth.js";

// The answer the passkey kit expects from a smart-account indexer (its "schema 2"): one
// candidate wallet per contract, complete only when the birth is known. Mercury's candidate
// summaries pass through; the birth fields come from the ledger.

/** One contract as Mercury's indexer describes it; only the fields this index reads are typed. */
export type IndexedContract = Record<string, unknown> & {
	contract_id: string;
	incomplete?: boolean;
	first_seen_ledger?: number | string;
};

/** The upstream indexers the kit knows, by network passphrase (its own defaults). */
export const UPSTREAM_INDEXERS: Record<string, string> = {
	"Test SDF Network ; September 2015": "https://testnet.mercurydata.app/rest/smart-account-indexer",
	"Public Global Stellar Network ; September 2015":
		"https://mainnet.mercurydata.app/rest/smart-account-indexer",
};

export function firstSeenLedger(contract: IndexedContract): number | null {
	const value = Number(contract.first_seen_ledger);
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** A schema-2 lookup response with every birth that could be found filled in. */
export function completeLookup(
	credentialId: string,
	contracts: readonly IndexedContract[],
	births: readonly (WalletBirth | null)[],
	indexedThroughLedger: number,
): Record<string, unknown> {
	const completed = contracts.map((contract, index) => {
		const birth = births[index];
		if (!birth) return contract;
		const { incompleteReasons: _dropped, ...rest } = contract;
		return {
			...rest,
			birth_wasm_hash: birth.wasmHash,
			creation_transaction_hash: birth.transactionHash,
			creation_ledger: birth.ledger,
			current_wasm_hash:
				typeof contract.current_wasm_hash === "string"
					? contract.current_wasm_hash
					: birth.wasmHash,
			derived_address:
				typeof contract.derived_address === "boolean" ? contract.derived_address : true,
			collision: typeof contract.collision === "boolean" ? contract.collision : false,
			incomplete: false,
		};
	});
	const complete = completed.every((contract) => contract.incomplete === false);
	return {
		schema: 2,
		complete,
		indexed_through_ledger: indexedThroughLedger,
		credentialId,
		count: completed.length,
		contracts: completed,
		...(complete ? {} : { incompleteReasons: ["index_behind"] }),
	};
}
