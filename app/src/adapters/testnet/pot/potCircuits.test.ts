import { readFileSync } from "node:fs";
import { UltraHonkBackend } from "@aztec/bb.js";
import { beforeAll, describe, expect, it } from "vitest";
import { commit, H, mul } from "./potCurve.ts";
import { type Hasher, loadHasher } from "./potHash.ts";
import { type PotKeys, potKeys } from "./potKeys.ts";
import {
	type Artifact,
	type ArtifactSource,
	type CircuitName,
	prove,
	verificationKey,
} from "./potProver.ts";
import { buildRegister, buildTransfer, buildWithdraw } from "./potWitness.ts";

// The circuits the app ships, against the keys the verifier holds on-chain, and proofs built
// from ancora's own witnesses checked the way the chain checks them.

const fromDisk: ArtifactSource = async (name) =>
	JSON.parse(readFileSync(`public/circuits/${name}.json`, "utf8")) as Artifact;
const onChainKey = (name: CircuitName) =>
	new Uint8Array(readFileSync(`../contracts/pot_verifier/vks/${name}.vk.bin`));

const POT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const ORG = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";

async function verifies(name: CircuitName, proof: { proof: Uint8Array; publicInputs: string[] }) {
	const backend = new UltraHonkBackend((await fromDisk(name)).bytecode, { threads: 1 });
	try {
		return await backend.verifyProof(proof, { keccak: true });
	} finally {
		await backend.destroy();
	}
}

let hasher: Hasher;
let keys: PotKeys;
let addrF: bigint;
beforeAll(async () => {
	hasher = await loadHasher();
	keys = await potKeys(hasher, new Uint8Array(32).fill(9), POT, ORG);
	addrF = hasher.addressToField(POT);
}, 60_000);

describe("the pot's circuits", () => {
	it.each(["register", "withdraw", "transfer"] as const)(
		"%s implies the verification key the verifier holds",
		async (name) => {
			expect(await verificationKey(name, fromDisk)).toEqual(onChainKey(name));
		},
		60_000,
	);

	it("proves a registration with keys derived from a root", async () => {
		const built = buildRegister(keys, addrF, hasher.addressToField(ORG));
		expect(await verifies("register", await prove("register", built.inputs, fromDisk))).toBe(true);
	}, 120_000);

	const spend = () => {
		const opening = { value: 50_000n, blinding: 123n };
		return {
			hasher,
			keys,
			addrF,
			current: commit(opening.value, opening.blinding),
			opening,
			senderAuditor: keys.auditorKey,
			amount: 12_000n,
		};
	};

	it("proves a withdrawal and keeps the new opening", async () => {
		const built = buildWithdraw(spend());
		expect(built.spendable.value).toBe(38_000n);
		expect(await verifies("withdraw", await prove("withdraw", built.inputs, fromDisk))).toBe(true);
	}, 120_000);

	it("proves a transfer the recipient can open", async () => {
		const recipient = { view: 777n };
		const built = buildTransfer({
			...spend(),
			recipientViewingKey: mul(H, recipient.view),
			recipientAuditor: mul(H, 5n),
		});
		expect(await verifies("transfer", await prove("transfer", built.inputs, fromDisk))).toBe(true);
	}, 120_000);

	it("refuses to spend more than the opening holds, or against a stale commitment", () => {
		expect(() => buildWithdraw({ ...spend(), amount: 60_000n })).toThrow();
		expect(() => buildWithdraw({ ...spend(), current: commit(1n, 1n) })).toThrow();
	});
});
