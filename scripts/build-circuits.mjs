// Compiles OpenZeppelin's confidential-token circuits (stellar-contracts v0.8.0,
// packages/confidential/circuits) for the confidential pot and writes what the browser needs to
// prove (ABI and bytecode) to app/public/circuits. Needs @noir-lang/noir_wasm 1.0.0-beta.11
// resolvable from the working directory, and a POSIX path (run it under Linux or WSL):
//
//   node scripts/build-circuits.mjs <path to packages/confidential/circuits>
//
// app/src/adapters/testnet/pot/potCircuits.test.ts derives each verification key from the
// written bytecode and checks it against contracts/pot_verifier/vks, the keys on-chain.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile_program, createFileManager } from "@noir-lang/noir_wasm";

const circuits = process.argv[2];
if (!circuits) throw new Error("Pass the path to OpenZeppelin's circuits directory.");
const out = resolve(import.meta.dirname, "../app/public/circuits");
for (const name of ["register", "withdraw", "transfer"]) {
	const { program } = await compile_program(createFileManager(circuits), resolve(circuits, name));
	const { noir_version, hash, abi, bytecode } = program;
	writeFileSync(`${out}/${name}.json`, JSON.stringify({ noir_version, hash, abi, bytecode }));
	process.stdout.write(`${name}: ${bytecode.length} bytes of bytecode\n`);
}
