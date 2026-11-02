import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type { PotOutcome, PotSupport } from "../../../domain/dataSource.ts";
import { ok, type Result } from "../../../domain/result.ts";
import type { RuleError } from "../../../domain/rules/model.ts";
import { address, toCents, toStroops, u32 } from "../scv.ts";
import {
	CIRCUIT_TYPE,
	nextAuditorId,
	potData,
	readAuditorKey,
	readPotAccount,
	readVerifierKey,
} from "./potChain.ts";
import { type PotStep, potCallToScVal } from "./potCodec.ts";
import { fieldOf, modR, pointBytes, pointOf } from "./potCurve.ts";
import { DOMAIN, loadHasher } from "./potHash.ts";
import { potKeys } from "./potKeys.ts";
import { type CircuitName, prove, verificationKey } from "./potProver.ts";
import { readPotRoot, sealPotRoot } from "./potRoot.ts";
import { loadPot, type OpenPot, type PotDeps, statusOf } from "./potState.ts";
import { buildRegister, buildTransfer, buildWithdraw } from "./potWitness.ts";

// The confidential pot on the testnet. Proofs are made on this device; every step that moves
// money is a request through the organization contract (`propose_pot`), so it runs only once the
// organization's own rules are met.

type Invoke = (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;

type Deps = PotDeps & {
	keyring: string;
	invoke: Invoke;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
};

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createPotSupport(deps: Deps): PotSupport {
	const { pot, verifier, auditors, asset } = deps.config;
	const checked = new Set<CircuitName>();

	/** The circuit this app proves is the one the verifier checks (the SDK's key-identity rule). */
	const sameKey = async (name: CircuitName) => {
		if (checked.has(name)) return;
		const [mine, onChain] = await Promise.all([
			verificationKey(name),
			readVerifierKey(deps.network, verifier, CIRCUIT_TYPE[name]),
		]);
		if (Buffer.compare(Buffer.from(mine), Buffer.from(onChain)) !== 0) {
			throw new Error(`The ${name} circuit here doesn't match the pot's verifier.`);
		}
		checked.add(name);
	};

	/** Directly for the founder during setup (as with deals), otherwise as a request. */
	const propose = async (
		orgId: string,
		actorId: string,
		step: PotStep,
	): Promise<Result<PotOutcome, RuleError>> => {
		const account = deps.account(orgId);
		const direct = account?.onchain?.setupPhase === true && account.org.founderId === actorId;
		const result = await deps.invoke(orgId, direct ? "pot_directly" : "propose_pot", [
			address(actorId),
			potCallToScVal(pot, step),
		]);
		if (!result.ok) return result;
		await deps.refresh();
		return ok(direct ? "applied" : "requested");
	};

	const guarded = async <T>(what: string, run: () => Promise<Result<T, RuleError>>) => {
		try {
			return await run();
		} catch (error) {
			return deps.failed(`${what}: ${describe(error)}`);
		}
	};

	/** The open pot, merged first when something arrived, so the proof spends everything. */
	const spendable = async (orgId: string, actorId: string): Promise<Result<OpenPot, RuleError>> => {
		const waiting = deps
			.account(orgId)
			?.requests.some(
				(r) =>
					r.kind === "pot" &&
					(r.action.type === "pay" || r.action.type === "withdraw") &&
					(r.status === "pending" || r.status === "scheduled" || r.status === "ready"),
			);
		if (waiting) {
			return deps.failed(
				"Another pot payment is waiting for approval; its proof would no longer fit. Wait until it's done.",
			);
		}
		let load = await loadPot(deps, orgId, actorId);
		if (load.state === "open" && load.balance.receiving.value > 0n) {
			const merged = await deps.invoke(orgId, "pot_merge", [address(actorId), address(pot)]);
			if (!merged.ok) return merged;
			load = await loadPot(deps, orgId, actorId);
		}
		if (load.state !== "open")
			return deps.failed("The pot isn't open and readable on this device.");
		return ok(load);
	};

	const done = async (result: Result<void, RuleError>) => {
		if (result.ok) await deps.refresh();
		return result;
	};

	return {
		contract: () => pot,
		asset: () => asset,
		status: (orgId, actorId) =>
			guarded("Couldn't read the pot", async () =>
				ok(statusOf(await loadPot(deps, orgId, actorId))),
			),
		open: (orgId, actorId) =>
			guarded("Couldn't open the pot", async () => {
				const load = await loadPot(deps, orgId, actorId);
				if (load.state === "unavailable") return deps.failed(load.reason);
				if (load.state !== "closed" && load.state !== "opening") {
					return deps.failed("The pot is already open.");
				}
				const hasher = await loadHasher();
				let stored = await readPotRoot(deps.reads, orgId, actorId, pot);
				if (!stored) {
					// A new pot key: its auditor key is registered first, then the key is saved.
					const root = crypto.getRandomValues(new Uint8Array(32));
					const keys = await potKeys(hasher, root, pot, orgId);
					const auditorId = await nextAuditorId(deps.network, auditors);
					const registered = await deps.invoke(auditors, "register_key", [
						u32(auditorId),
						xdr.ScVal.scvBytes(Buffer.from(pointBytes(keys.auditorKey))),
						address(actorId),
					]);
					if (!registered.ok) return registered;
					const epoch = await deps.reads.epochOf(orgId);
					const key = (await deps.reads.keysFor(orgId, actorId)).get(epoch);
					if (!key) return deps.failed("This device can't read private details.");
					stored = { root, auditorId };
					const saved = await deps.invoke(deps.keyring, "set_label", [
						address(actorId),
						address(orgId),
						address(pot),
						xdr.ScVal.scvBytes(
							Buffer.from(new TextEncoder().encode(await sealPotRoot(stored, key, epoch))),
						),
					]);
					if (!saved.ok) return saved;
				}
				const keys = await potKeys(hasher, stored.root, pot, orgId);
				await sameKey("register");
				const built = buildRegister(keys, hasher.addressToField(pot), hasher.addressToField(orgId));
				const { proof } = await prove("register", built.inputs);
				return propose(orgId, actorId, {
					type: "register",
					auditorId: stored.auditorId,
					data: potData(built.payload, proof),
				});
			}),
		deposit: (orgId, actorId, amount) =>
			guarded("Couldn't move money into the pot", async () =>
				propose(orgId, actorId, { type: "deposit", amount: toStroops(amount) }),
			),
		merge: (orgId, actorId) =>
			guarded("Couldn't make the pot's incoming money spendable", async () =>
				done(await deps.invoke(orgId, "pot_merge", [address(actorId), address(pot)])),
			),
		withdraw: (orgId, actorId, amount) =>
			guarded("Couldn't take money out of the pot", async () => {
				const open = await spendable(orgId, actorId);
				if (!open.ok) return open;
				const { hasher, keys, onChain, balance } = open.value;
				await sameKey("withdraw");
				const built = buildWithdraw({
					hasher,
					keys,
					addrF: hasher.addressToField(pot),
					current: onChain.spendable,
					opening: balance.spendable,
					senderAuditor: await readAuditorKey(deps.network, auditors, onChain.auditorId),
					amount: toStroops(amount),
				});
				const { proof } = await prove("withdraw", built.inputs);
				const data = potData(built.payload, proof);
				return propose(orgId, actorId, { type: "withdraw", amount: toStroops(amount), data });
			}),
		pay: (orgId, actorId, to, amount) =>
			guarded("Couldn't pay from the pot", async () => {
				const recipient = await readPotAccount(deps.network, pot, to);
				if (!recipient) {
					return deps.failed(
						"They have no pot account yet. Ask them to open their confidential pot.",
					);
				}
				const open = await spendable(orgId, actorId);
				if (!open.ok) return open;
				const { hasher, keys, onChain, balance } = open.value;
				await sameKey("transfer");
				const [senderAuditor, recipientAuditor] = await Promise.all([
					readAuditorKey(deps.network, auditors, onChain.auditorId),
					readAuditorKey(deps.network, auditors, recipient.auditorId),
				]);
				const built = buildTransfer({
					hasher,
					keys,
					addrF: hasher.addressToField(pot),
					current: onChain.spendable,
					opening: balance.spendable,
					senderAuditor,
					amount: toStroops(amount),
					recipientViewingKey: recipient.viewingKey,
					recipientAuditor,
				});
				const { proof } = await prove("transfer", built.inputs);
				return propose(orgId, actorId, { type: "pay", to, data: potData(built.payload, proof) });
			}),
		amountOf: (orgId, actorId, sealed) =>
			guarded("Couldn't read the amount", async () => {
				const stored = await readPotRoot(deps.reads, orgId, actorId, pot);
				if (!stored) return deps.failed("This device can't read the pot key.");
				const hasher = await loadHasher();
				const keys = await potKeys(hasher, stored.root, pot, orgId);
				const data = scValToNative(xdr.ScVal.fromXDR(Buffer.from(sealed, "base64"))) as {
					payload: Record<string, Uint8Array>;
				};
				const field = (name: string) => fieldOf(data.payload[name] ?? new Uint8Array());
				const ephemeral = pointOf(data.payload.r_e_point ?? new Uint8Array(64));
				const sigma = field("sigma");
				const [mask] = hasher.squeeze3(
					DOMAIN.auditorSender,
					hasher.ecdh(keys.auditor, ephemeral),
					sigma,
				);
				return ok(toCents(modR(field("v_tilde_aud_s") - mask)));
			}),
	};
}
