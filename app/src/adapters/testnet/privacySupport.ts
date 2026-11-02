import { xdr } from "@stellar/stellar-sdk";
import type { OrgAccount } from "../../domain/account.ts";
import type { PrivacyStatus, PrivacySupport } from "../../domain/dataSource.ts";
import { fitsPrivately, type PayeeLabel } from "../../domain/privateNote.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import { writeDeviceBytes } from "./deviceStore.ts";
import { hex, type KeyringReads, keyringReads, PRIVATE_KEY_DATABASE } from "./keyringReads.ts";
import type { PasskeyKeys } from "./passkeyKeys.ts";
import {
	encryptNote,
	newKeyPair,
	newOrganizationKey,
	publicKeyOf,
	wrapKey,
} from "./privateCrypto.ts";
import { revealFor, sealLabel } from "./privateLabels.ts";
import type { Network } from "./readContract.ts";
import { address, u32 } from "./scv.ts";

// Private details on the testnet: the person's X25519 secret stays in this browser
// (deviceStore), the public key, the wrapped organization keys, the auditors and the encrypted
// recipient labels live in ancora's keyring contract, which asks the organization contract who
// its members are.

export { PRIVATE_KEY_DATABASE };

type Invoke = (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;

type Deps = {
	network: Network;
	keyring: string;
	invoke: Invoke;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
	/** The organization's members, as last read. */
	members: (orgId: string) => readonly PersonId[];
	/** Any organization read from its contract (for auditors, who aren't members). */
	readAccount: (orgId: string) => Promise<OrgAccount>;
	/** The person's keys derived from their passkey, or null when it can't make them. */
	passkeyKeys: () => Promise<PasskeyKeys | null>;
};

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export type PrivateKeys = {
	support: PrivacySupport;
	reads: KeyringReads;
	/**
	 * `text` encrypted with the current key, `text` itself while nothing is private, or an error
	 * when the organization is private but this device can't write privately. `onChain` texts
	 * must still fit a 140-character reference once encrypted.
	 */
	protect: (
		orgId: string,
		personId: PersonId,
		text: string,
		onChain: boolean,
	) => Promise<Result<string, RuleError>>;
	/**
	 * Saves a recipient's real name and note encrypted in the keyring when details are private,
	 * and returns what to store on-chain (a placeholder then, the label itself otherwise).
	 */
	protectLabel: (
		orgId: string,
		personId: PersonId,
		subject: string,
		label: PayeeLabel,
	) => Promise<Result<PayeeLabel, RuleError>>;
};

export function createPrivateKeys(deps: Deps): PrivateKeys {
	const reads = keyringReads(deps.network, deps.keyring);
	const recipients = async (orgId: string) => [
		...new Set([...deps.members(orgId), ...(await reads.auditors(orgId))]),
	];
	const currentKey = async (orgId: string, person: PersonId) => {
		const epoch = await reads.epochOf(orgId);
		if (epoch === 0) return { epoch, key: null };
		return { epoch, key: (await reads.keysFor(orgId, person)).get(epoch) ?? null };
	};
	const cannotWrite = () =>
		deps.failed(
			"This organization keeps details private, and this device can't write them yet. Set it up under Settings → Private details.",
		);

	/** Shares `key` of `epoch` with every member and auditor whose copy is missing or stale. */
	const shareKey = async (orgId: string, actor: PersonId, epoch: number, key: Uint8Array) => {
		let shared = 0;
		for (const person of await recipients(orgId)) {
			const published = await reads.publicKey(person);
			if (!published) continue;
			const existing = await reads.wrappedFor(orgId, person, epoch);
			if (existing && existing.forKey === hex(published)) continue;
			const result = await deps.invoke(deps.keyring, "share", [
				address(actor),
				address(orgId),
				address(person),
				u32(epoch),
				xdr.ScVal.scvBytes(Buffer.from(await wrapKey(key, published))),
			]);
			if (!result.ok) return result;
			shared += 1;
		}
		return ok(shared);
	};

	const status = async (orgId: string, actor: PersonId): Promise<PrivacyStatus> => {
		const [epoch, secret, mine, auditors] = await Promise.all([
			reads.epochOf(orgId),
			reads.deviceSecret(actor),
			reads.publicKey(actor),
			reads.auditors(orgId),
		]);
		const deviceReady = secret !== null && mine !== null && hex(publicKeyOf(secret)) === hex(mine);
		const keys = deviceReady ? await reads.keysFor(orgId, actor) : new Map<number, Uint8Array>();
		const waiting: PersonId[] = [];
		const withoutKey: PersonId[] = [];
		for (const person of await recipients(orgId)) {
			const published = await reads.publicKey(person);
			if (!published) {
				withoutKey.push(person);
				continue;
			}
			const wrapped = epoch > 0 ? await reads.wrappedFor(orgId, person, epoch) : null;
			if (epoch > 0 && (!wrapped || wrapped.forKey !== hex(published))) waiting.push(person);
		}
		return { epoch, deviceReady, canRead: keys.has(epoch), waiting, withoutKey, auditors };
	};

	const guarded = async <T>(what: string, run: () => Promise<Result<T, RuleError>>) => {
		try {
			return await run();
		} catch (error) {
			return deps.failed(`${what}: ${describe(error)}`);
		}
	};

	const support: PrivacySupport = {
		epoch: (orgId) => reads.epochOf(orgId).catch(() => 0),
		status: (orgId, actor) =>
			guarded("Couldn't read the private details setup", async () =>
				ok(await status(orgId, actor)),
			),
		setUpDevice: (actor) =>
			guarded("Couldn't set up private details on this device", async () => {
				let secret = await reads.deviceSecret(actor);
				if (!secret) {
					// From the passkey when it can, so the key comes back wherever the passkey does.
					secret = (await deps.passkeyKeys())?.privateKey ?? newKeyPair().secretKey;
					await writeDeviceBytes(PRIVATE_KEY_DATABASE, actor, secret);
				}
				return deps.invoke(deps.keyring, "set_key", [
					address(actor),
					xdr.ScVal.scvBytes(Buffer.from(publicKeyOf(secret))),
				]);
			}),
		newEpoch: (orgId, actor) =>
			guarded("Couldn't renew the organization's key", async () => {
				const current = await status(orgId, actor);
				if (!current.deviceReady)
					return deps.failed("Set up private details on this device first.");
				const opened = await deps.invoke(deps.keyring, "open_epoch", [
					address(actor),
					address(orgId),
				]);
				if (!opened.ok) return opened;
				const shared = await shareKey(orgId, actor, current.epoch + 1, newOrganizationKey());
				await deps.refresh();
				return shared.ok ? ok(undefined) : shared;
			}),
		shareWaiting: (orgId, actor) =>
			guarded("Couldn't share access", async () => {
				let total = 0;
				for (const [epoch, key] of await reads.keysFor(orgId, actor)) {
					const shared = await shareKey(orgId, actor, epoch, key);
					if (!shared.ok) return shared;
					total += shared.value;
				}
				return ok(total);
			}),
		addAuditor: (orgId, actor, auditor) =>
			guarded("Couldn't add the auditor", () =>
				deps.invoke(deps.keyring, "add_auditor", [
					address(actor),
					address(orgId),
					address(auditor.trim()),
				]),
			),
		removeAuditor: (orgId, actor, auditor) =>
			guarded("Couldn't remove the auditor", () =>
				deps.invoke(deps.keyring, "remove_auditor", [
					address(actor),
					address(orgId),
					address(auditor),
				]),
			),
		audit: (orgId, person) =>
			guarded("Couldn't open this organization", async () =>
				ok(await revealFor(reads, await deps.readAccount(orgId), person)),
			),
	};

	const protect = async (orgId: string, person: PersonId, text: string, onChain: boolean) => {
		if (!text) return ok(text);
		const { epoch, key } = await currentKey(orgId, person);
		if (epoch === 0) return ok(text);
		if (!key) return cannotWrite();
		if (onChain && !fitsPrivately(text, epoch)) {
			return deps.failed("Private references are limited to about 70 characters. Shorten it.");
		}
		return ok(await encryptNote(text, key, epoch));
	};

	const protectLabel = async (
		orgId: string,
		person: PersonId,
		subject: string,
		label: PayeeLabel,
	): Promise<Result<PayeeLabel, RuleError>> => {
		const { epoch, key } = await currentKey(orgId, person);
		if (epoch === 0) return ok(label);
		if (!key) return cannotWrite();
		const sealed = await sealLabel(label, key, epoch);
		if (!sealed)
			return deps.failed("This name and note are too long to keep private. Shorten them.");
		const stored = await deps.invoke(deps.keyring, "set_label", [
			address(person),
			address(orgId),
			address(subject),
			xdr.ScVal.scvBytes(Buffer.from(new TextEncoder().encode(sealed.sealed))),
		]);
		return stored.ok ? ok(sealed.onChain) : stored;
	};

	return { support, reads, protect, protectLabel };
}
