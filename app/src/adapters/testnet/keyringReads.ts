import type { PersonId } from "../../domain/rules/model.ts";
import { readDeviceBytes } from "./deviceStore.ts";
import { publicKeyOf, unwrapKey } from "./privateCrypto.ts";
import { type Network, readContract } from "./readContract.ts";
import { address, u32 } from "./scv.ts";

// Reads from ancora's keyring contract, and the device secret they are opened with.

/** Where the person's X25519 secret for private details is kept in this browser. */
export const PRIVATE_KEY_DATABASE = "ancora-private";

export type Wrapped = { key: Uint8Array; forKey: string };

export const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

export type KeyringReads = ReturnType<typeof keyringReads>;

export function keyringReads(network: Network, keyring: string) {
	const read = (fn: string, args: Parameters<typeof readContract>[3]) =>
		readContract(network, keyring, fn, args);

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
	const auditors = async (orgId: string) =>
		((await read("auditors", [address(orgId)])) as string[]).map(String);
	/** Encrypted labels by labelled address. */
	const labels = async (orgId: string) => {
		const map = (await read("labels", [address(orgId)])) as Record<string, Uint8Array> | null;
		return new Map(
			Object.entries(map ?? {}).map(([who, bytes]) => [who, new TextDecoder().decode(bytes)]),
		);
	};
	const deviceSecret = (person: PersonId) => readDeviceBytes(PRIVATE_KEY_DATABASE, person);

	/** The organization keys this device can open for the person, by epoch. */
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

	return { publicKey, epochOf, wrappedFor, auditors, labels, deviceSecret, keysFor };
}
