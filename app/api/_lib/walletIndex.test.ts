import { describe, expect, it } from "vitest";
import { completeLookup, firstSeenLedger, type IndexedContract } from "./walletIndex.js";

// Mercury's real answer for a wallet it had seen but whose birth it did not know (26 Oct 2026).
const mercury: IndexedContract = {
	contract_id: "CADJJPCVWXAFK4M75PISVW5TPQPWLEUUT7KEIGNNVRMNRG2BC3YAZSAX",
	context_rule_count: 1,
	external_signer_count: 1,
	first_seen_ledger: "5396949",
	last_seen_ledger: 5396949,
	birth_wasm_hash: null,
	creation_transaction_hash: null,
	creation_ledger: null,
	current_wasm_hash: "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
	derived_address: true,
	collision: false,
	incomplete: true,
	incompleteReasons: ["missing_birth"],
};
const birth = {
	transactionHash: "ab".repeat(32),
	ledger: 5396949,
	wasmHash: "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
};

describe("completeLookup", () => {
	it("fills the birth in and marks the answer complete", () => {
		const answer = completeLookup("10a9", [mercury], [birth], 5397100);
		expect(answer).toMatchObject({ schema: 2, complete: true, count: 1, credentialId: "10a9" });
		expect(answer).not.toHaveProperty("incompleteReasons");
		const [contract] = answer.contracts as Record<string, unknown>[];
		expect(contract).toMatchObject({
			creation_transaction_hash: birth.transactionHash,
			creation_ledger: 5396949,
			birth_wasm_hash: birth.wasmHash,
			incomplete: false,
			derived_address: true,
			collision: false,
		});
		expect(contract).not.toHaveProperty("incompleteReasons");
	});

	it("stays incomplete when the birth was not found", () => {
		const answer = completeLookup("10a9", [mercury], [null], 5397100);
		expect(answer).toMatchObject({ complete: false, incompleteReasons: ["index_behind"] });
	});

	it("reads the first-seen ledger whether Mercury sends a number or a string", () => {
		expect(firstSeenLedger(mercury)).toBe(5396949);
		expect(firstSeenLedger({ contract_id: "C", first_seen_ledger: 12 })).toBe(12);
		expect(firstSeenLedger({ contract_id: "C" })).toBeNull();
	});
});
