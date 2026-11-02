import { xdr } from "@stellar/stellar-sdk";
import type { PrivacyStatus, PrivacySupport } from "../../domain/dataSource.ts";
import { fitsPrivately } from "../../domain/privateNote.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { PersonId, RuleError } from "../../domain/rules/model.ts";
import { readDeviceBytes, writeDeviceBytes } from "./deviceStore.ts";
import {
	encryptNote,
	newKeyPair,
	newOrganizationKey,
	publicKeyOf,
	unwrapKey,
	wrapKey,
} from "./privateCrypto.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u32 } from "./scv.ts";

// Private details on the testnet: the person's X25519 secret stays in this browser
// (deviceStore), the public key and the wrapped organization keys live in ancora's keyring
// contract, and the keyring asks the organization contract who its members are.

const DATABASE = "ancora-private";

type Invoke = (target: string, fn: string, args: xdr.ScVal[]) => Promise<Result<void, RuleError>>;

type Deps = {
	network: Network;
	keyring: string;
	invoke: Invoke;
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
	/** The organization's members, as last read. */
	members: (orgId: string) => readonly PersonId[];
};

type Wrapped = { key: Uint8Array; forKey: string };

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export type PrivateKeys = {
	support: PrivacySupport;
	/** The organization keys this device can open, by epoch (empty while nothing is private). */
	keysFor: (orgId: string, personId: PersonId) => Promise<Map<number, Uint8Array>>;
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
};

export function createPrivateKeys(deps: Deps): PrivateKeys {
	const read = (fn: string, args: xdr.ScVal[]) =>
		readContract(deps.network, deps.keyring, fn, args);
	const publicKey = async (person: PersonId) => {
		const key = (await read("key", [address(person)])) as Uint8Array | null;
		return key ? new Uint8Array(key) : null;
	};
	const epochOf = async (orgId: string) => Number(await read("epoch", [address(orgId)]));
	const wrappedFor = async (orgId: string, member: PersonId, epoch: number) => {
		const row = (await read("wrapped", [address(orgId), address(member), u32(epoch)])) as {
			key: Uint8Array;
			for_key: Uint8Array;
		} | null;
		return row ? ({ key: new Uint8Array(row.key), forKey: hex(row.for_key) } as Wrapped) : null;
	};
	const deviceSecret = (person: PersonId) => readDeviceBytes(DATABASE, person);

	const keysFor = async (orgId: string, person: PersonId) => {
		const keys = new Map<number, Uint8Array>();
		const [epoch, secret] = await Promise.all([epochOf(orgId), deviceSecret(person)]);
		if (epoch === 0 || !secret) return keys;
		const mine = hex(publicKeyOf(secret));
		for (let e = 1; e <= epoch; e++) {
			const wrapped = await wrappedFor(orgId, person, e);
			if (wrapped && wrapped.forKey === mine) keys.set(e, await unwrapKey(wrapped.key, secret));
		}
		return keys;
	};

	/** Shares `key` of `epoch` with every member whose copy is missing or for an old key. */
	const shareKey = async (orgId: string, actor: PersonId, epoch: number, key: Uint8Array) => {
		let shared = 0;
		for (const member of deps.members(orgId)) {
			const published = await publicKey(member);
			if (!published) continue;
			const existing = await wrappedFor(orgId, member, epoch);
			if (existing && existing.forKey === hex(published)) continue;
			const result = await deps.invoke(deps.keyring, "share", [
				address(actor),
				address(orgId),
				address(member),
				u32(epoch),
				xdr.ScVal.scvBytes(Buffer.from(await wrapKey(key, published))),
			]);
			if (!result.ok) return result;
			shared += 1;
		}
		return ok(shared);
	};

	const status = async (orgId: string, actor: PersonId): Promise<PrivacyStatus> => {
		const [epoch, secret, mine] = await Promise.all([
			epochOf(orgId),
			deviceSecret(actor),
			publicKey(actor),
		]);
		const deviceReady = secret !== null && mine !== null && hex(publicKeyOf(secret)) === hex(mine);
		const keys = deviceReady ? await keysFor(orgId, actor) : new Map<number, Uint8Array>();
		const waiting: PersonId[] = [];
		const withoutKey: PersonId[] = [];
		for (const member of deps.members(orgId)) {
			const published = await publicKey(member);
			if (!published) {
				withoutKey.push(member);
				continue;
			}
			const wrapped = epoch > 0 ? await wrappedFor(orgId, member, epoch) : null;
			if (epoch > 0 && (!wrapped || wrapped.forKey !== hex(published))) waiting.push(member);
		}
		return { epoch, deviceReady, canRead: keys.has(epoch), waiting, withoutKey };
	};

	const support: PrivacySupport = {
		status: async (orgId, actor) => {
			try {
				return ok(await status(orgId, actor));
			} catch (error) {
				return deps.failed(`Couldn't read the private details setup: ${describe(error)}`);
			}
		},
		setUpDevice: async (actor) => {
			try {
				let secret = await deviceSecret(actor);
				if (!secret) {
					secret = newKeyPair().secretKey;
					await writeDeviceBytes(DATABASE, actor, secret);
				}
				const result = await deps.invoke(deps.keyring, "set_key", [
					address(actor),
					xdr.ScVal.scvBytes(Buffer.from(publicKeyOf(secret))),
				]);
				return result;
			} catch (error) {
				return deps.failed(`Couldn't set up private details on this device: ${describe(error)}`);
			}
		},
		newEpoch: async (orgId, actor) => {
			try {
				const current = await status(orgId, actor);
				if (!current.deviceReady) {
					return deps.failed("Set up private details on this device first.");
				}
				const opened = await deps.invoke(deps.keyring, "open_epoch", [
					address(actor),
					address(orgId),
				]);
				if (!opened.ok) return opened;
				const shared = await shareKey(orgId, actor, current.epoch + 1, newOrganizationKey());
				await deps.refresh();
				return shared.ok ? ok(undefined) : shared;
			} catch (error) {
				return deps.failed(`Couldn't renew the organization's key: ${describe(error)}`);
			}
		},
		shareWaiting: async (orgId, actor) => {
			try {
				let total = 0;
				for (const [epoch, key] of await keysFor(orgId, actor)) {
					const shared = await shareKey(orgId, actor, epoch, key);
					if (!shared.ok) return shared;
					total += shared.value;
				}
				return ok(total);
			} catch (error) {
				return deps.failed(`Couldn't share access: ${describe(error)}`);
			}
		},
	};

	const protect = async (orgId: string, person: PersonId, text: string, onChain: boolean) => {
		if (!text) return ok(text);
		const epoch = await epochOf(orgId);
		if (epoch === 0) return ok(text);
		const key = (await keysFor(orgId, person)).get(epoch);
		if (!key) {
			return deps.failed(
				"This organization keeps references private, and this device can't write them yet. Set it up under Settings → Private details.",
			);
		}
		if (onChain && !fitsPrivately(text, epoch)) {
			return deps.failed("Private references are limited to about 70 characters. Shorten it.");
		}
		return ok(await encryptNote(text, key, epoch));
	};

	return { support, keysFor, protect };
}
