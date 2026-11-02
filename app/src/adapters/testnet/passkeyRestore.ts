import { writeDeviceBytes } from "./deviceStore.ts";
import { hex, PRIVATE_KEY_DATABASE } from "./keyringReads.ts";
import type { PasskeyKeys } from "./passkeyKeys.ts";
import { publicKeyOf } from "./privateCrypto.ts";
import { type Network, readContract } from "./readContract.ts";
import { address } from "./scv.ts";
import { SEAL_KEY_DATABASE, sealPublicKey } from "./sealKey.ts";

// Bringing device keys back with the passkey: the keys derived from it are kept only where they
// are the ones the person published (the keyring's encryption key, an organization's seal key),
// so a passkey that made its keys some other way (at random, before PRF) changes nothing.

type Deps = {
	network: Network;
	/** The person's published encryption key, null when none (or no keyring). */
	publishedKey: (personId: string) => Promise<Uint8Array | null>;
	/** The organizations the person belongs to, where a seal key may be registered. */
	organizations: (personId: string) => readonly string[];
	passkeyKeys: () => Promise<PasskeyKeys | null>;
};

export type Restored = { privateKey: boolean; sealKey: boolean };

/** The seal keys registered for the person, as hex; organizations without seals add none. */
async function registeredSealKeys(deps: Deps, personId: string): Promise<Set<string>> {
	const keys = await Promise.all(
		deps.organizations(personId).map((org) =>
			readContract(deps.network, org, "seal_key", [address(personId)]).catch(
				// Code before seals (interface 9) has no seal keys; an unreadable organization
				// leaves its seal key unrestored, which the result reports.
				() => null,
			),
		),
	);
	return new Set(keys.filter((key) => key instanceof Uint8Array).map((key) => hex(key)));
}

/** Keeps the passkey's keys on this device where they match; null when it gives none. */
export async function restoreWithPasskey(deps: Deps, personId: string): Promise<Restored | null> {
	const keys = await deps.passkeyKeys();
	if (!keys) return null;
	const [published, sealKeys] = await Promise.all([
		deps.publishedKey(personId),
		registeredSealKeys(deps, personId),
	]);
	const privateKey = published !== null && hex(publicKeyOf(keys.privateKey)) === hex(published);
	const sealKey = sealKeys.has(hex(sealPublicKey(keys.sealSeed)));
	if (privateKey) await writeDeviceBytes(PRIVATE_KEY_DATABASE, personId, keys.privateKey);
	if (sealKey) await writeDeviceBytes(SEAL_KEY_DATABASE, personId, keys.sealSeed);
	return { privateKey, sealKey };
}
