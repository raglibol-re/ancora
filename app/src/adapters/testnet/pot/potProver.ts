import type { CompiledCircuit } from "@noir-lang/noir_js";
import type { CircuitInputs } from "./potWitness.ts";

// Proving in the browser: noir_js turns the inputs into a witness, bb.js proves it with
// UltraHonk over a Keccak transcript (what the on-chain verifier replays) and without zero
// knowledge mode (the verifier's flavour). Both are pinned to the versions OpenZeppelin's keys
// were made with, and nothing leaves the device: the spending key is a witness. One thread,
// since the site doesn't run cross-origin isolated (no SharedArrayBuffer).

export type CircuitName = "register" | "withdraw" | "transfer";

/** A compiled circuit as public/circuits holds it (scripts/build-circuits.mjs). */
export type Artifact = CompiledCircuit;

export type ArtifactSource = (name: CircuitName) => Promise<Artifact>;

export class PotProofError extends Error {}

const fromSite: ArtifactSource = async (name) => {
	const response = await fetch(`/circuits/${name}.json`);
	if (!response.ok)
		throw new PotProofError(`The ${name} circuit didn't load (${response.status}).`);
	return (await response.json()) as Artifact;
};

/** The proof (bytes) for `inputs`, and the public inputs it commits to. */
export async function prove(
	name: CircuitName,
	inputs: CircuitInputs,
	source: ArtifactSource = fromSite,
): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
	const [artifact, { Noir }, { UltraHonkBackend }] = await Promise.all([
		source(name),
		import("@noir-lang/noir_js"),
		import("@aztec/bb.js"),
	]);
	let witness: Uint8Array;
	try {
		({ witness } = await new Noir(artifact).execute(inputs));
	} catch (error) {
		throw new PotProofError(
			`The ${name} proof's inputs don't hold together: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const backend = new UltraHonkBackend(artifact.bytecode, { threads: 1 });
	try {
		const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
		return { proof, publicInputs };
	} finally {
		await backend.destroy();
	}
}

/** The verification key a circuit's bytecode implies, to compare with the one on-chain. */
export async function verificationKey(
	name: CircuitName,
	source: ArtifactSource = fromSite,
): Promise<Uint8Array> {
	const [artifact, { UltraHonkBackend }] = await Promise.all([
		source(name),
		import("@aztec/bb.js"),
	]);
	const backend = new UltraHonkBackend(artifact.bytecode, { threads: 1 });
	try {
		return await backend.getVerificationKey({ keccak: true });
	} finally {
		await backend.destroy();
	}
}
