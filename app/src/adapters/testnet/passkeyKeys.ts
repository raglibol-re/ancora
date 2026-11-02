// The passkey as a second way back for the keys that live on a device. WebAuthn's PRF extension
// returns a secret that only this passkey produces, on every device the passkey syncs to; the
// encryption key for private details and the seal seed are derived from it, so they come back
// wherever the passkey does and nothing is stored anywhere. Passkeys or browsers without PRF
// give nothing, and the keys are made at random (the backup code still brings them back).

const SALT = new TextEncoder().encode("ancora/device-keys/v1");

export type PasskeyKeys = { privateKey: Uint8Array; sealSeed: Uint8Array };

async function derive(secret: Uint8Array, info: string): Promise<Uint8Array> {
	const base = await crypto.subtle.importKey("raw", Uint8Array.from(secret), "HKDF", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new TextEncoder().encode(info) },
		base,
		256,
	);
	return new Uint8Array(bits);
}

/** The device keys that belong to a passkey's PRF secret: the same secret, the same keys. */
export async function keysFromSecret(secret: Uint8Array): Promise<PasskeyKeys> {
	const [privateKey, sealSeed] = await Promise.all([
		derive(secret, "ancora/private-details-key"),
		derive(secret, "ancora/seal-seed"),
	]);
	return { privateKey, sealSeed };
}

const fromBase64Url = (text: string) =>
	Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

/**
 * Asks the person's passkey (the one this pass signs with, when known) for its PRF secret and
 * derives the device keys from it; null when the passkey or the browser has no PRF. Cancelling
 * the prompt throws, like any passkey step.
 */
export async function passkeyKeys(credentialId: string | undefined): Promise<PasskeyKeys | null> {
	const credential = await navigator.credentials.get({
		publicKey: {
			challenge: crypto.getRandomValues(new Uint8Array(32)),
			rpId: window.location.hostname,
			userVerification: "required",
			allowCredentials: credentialId
				? [{ type: "public-key", id: fromBase64Url(credentialId) }]
				: [],
			extensions: { prf: { eval: { first: SALT } } },
		},
	});
	if (!(credential instanceof PublicKeyCredential)) return null;
	const first = credential.getClientExtensionResults().prf?.results?.first;
	if (!first) return null;
	return keysFromSecret(
		first instanceof ArrayBuffer
			? new Uint8Array(first)
			: new Uint8Array(first.buffer, first.byteOffset, first.byteLength),
	);
}
