import { describe, expect, it } from "vitest";
import type { OrgAccount } from "../../domain/account.ts";
import { PRIVATE_PAYEE_NAME, revealPayees, UNREADABLE_PAYEE } from "../../domain/privateNote.ts";
import type { KeyringReads } from "./keyringReads.ts";
import { newOrganizationKey } from "./privateCrypto.ts";
import { labelsFor, sealLabel } from "./privateLabels.ts";

/** A keyring that holds the given encrypted labels and nothing else. */
const keyringWith = (labels: Map<string, string>) =>
	({ labels: async () => labels }) as unknown as KeyringReads;

describe("private recipient labels", () => {
	it("store a placeholder on-chain and open with the organization key", async () => {
		const key = newOrganizationKey();
		const sealed = await sealLabel({ name: "Ana Costa", note: "Coach" }, key, 1);
		expect(sealed?.onChain).toEqual({ name: PRIVATE_PAYEE_NAME, note: "" });
		const reads = keyringWith(new Map([["GANA", sealed?.sealed ?? ""]]));
		expect(await labelsFor(reads, "CORG", new Map([[1, key]]))).toEqual(
			new Map([["GANA", { name: "Ana Costa", note: "Coach" }]]),
		);
		expect(await labelsFor(reads, "CORG", new Map([[1, newOrganizationKey()]]))).toEqual(new Map());
	});

	it("refuse labels too long for the keyring", async () => {
		expect(
			await sealLabel({ name: "x".repeat(400), note: "" }, newOrganizationKey(), 1),
		).toBeNull();
	});

	it("name private recipients by their label, or as private when unreadable", () => {
		const account = {
			payees: [
				{ id: "GANA", name: PRIVATE_PAYEE_NAME, account: "GANA" },
				{ id: "GRUI", name: PRIVATE_PAYEE_NAME, account: "GRUI" },
				{ id: "GSHOP", name: "Shop", account: "GSHOP" },
			],
		} as unknown as OrgAccount;
		const shown = revealPayees(account, new Map([["GANA", { name: "Ana Costa", note: "Coach" }]]));
		expect(shown.payees.map((p) => p.name)).toEqual(["Ana Costa", UNREADABLE_PAYEE, "Shop"]);
	});
});
