import { xdr } from "@stellar/stellar-sdk";
import type { ContinuitySupport } from "../../domain/dataSource.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import type { PasskeyKeys } from "./passkeyKeys.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u64 } from "./scv.ts";
import { createSealKey, loadSealKey, toHex } from "./sealKey.ts";

type Invoke = (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;

type Deps = {
	network: Network;
	/** ancora's ML-DSA verifier, which organizations may name for their seals. */
	verifier: string;
	invoke: Invoke;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
	/** The person's keys derived from their passkey, or null when it can't make them. */
	passkeyKeys: () => Promise<PasskeyKeys | null>;
};

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Lifeline succession and quantum-safe seal keys on the testnet. */
export function createContinuitySupport(deps: Deps): ContinuitySupport {
	const run = async (target: string, fn: string, args: xdr.ScVal[]) => {
		const result = await deps.invoke(target, fn, args);
		if (result.ok) await deps.refresh();
		return result;
	};
	return {
		verifier: () => deps.verifier,
		stillHere: (orgId, actorId) => run(orgId, "still_here", [address(actorId)]),
		claim: (orgId, actorId, memberId) =>
			run(orgId, "claim_succession", [address(actorId), address(memberId)]),
		finish: (orgId, memberId) => run(orgId, "finish_succession", [address(memberId)]),
		deviceSealKey: async (personId) => {
			try {
				const key = await loadSealKey(personId);
				return key ? toHex(key.publicKey) : null;
			} catch {
				// No storage (private window): there is simply no key on this device.
				return null;
			}
		},
		createSealKey: async (orgId, actorId) => {
			try {
				const key = await createSealKey(
					actorId,
					async () => (await deps.passkeyKeys())?.sealSeed ?? null,
				);
				return await run(orgId, "set_seal_key", [
					address(actorId),
					xdr.ScVal.scvBytes(Buffer.from(key.publicKey)),
				]);
			} catch (error) {
				return deps.failed(`Couldn't create a seal key on this device: ${describe(error)}`);
			}
		},
	};
}

/** Seals with this device's key: signs what the organization says it expects for the request. */
export async function sealWithDeviceKey(
	deps: Pick<Deps, "network" | "invoke" | "failed">,
	orgId: string,
	requestId: number,
	actorId: PersonId,
): Promise<Result<void, RuleError>> {
	try {
		const key = await loadSealKey(actorId);
		if (!key) {
			return deps.failed(
				"This organization seals with quantum-safe keys, and this device has none for you. Create one under Settings → Security seal, or seal from the device that has it.",
			);
		}
		const payload = (await readContract(deps.network, orgId, "seal_payload", [
			u64(requestId),
		])) as Uint8Array;
		const signature = key.sign(payload);
		const result = await deps.invoke(orgId, "seal_with_key", [
			address(actorId),
			u64(requestId),
			xdr.ScVal.scvBytes(Buffer.from(signature)),
		]);
		return result.ok ? ok(undefined) : result;
	} catch (error) {
		return deps.failed(`Couldn't sign the seal on this device: ${describe(error)}`);
	}
}
