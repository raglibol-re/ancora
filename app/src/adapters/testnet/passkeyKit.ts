import { IndexedDBStorage, SmartAccountKit } from "smart-account-kit";
import type { TestnetConfig } from "./testnetConfig.ts";

let kit: SmartAccountKit | null = null;

/**
 * One smart-account-kit instance per page. Passkeys are bound to this site's domain (the WebAuthn
 * relying party), so a passkey created on the production domain only works there.
 */
export function passkeyKit(config: TestnetConfig): SmartAccountKit {
	kit ??= new SmartAccountKit({
		rpcUrl: config.rpcUrl,
		networkPassphrase: config.networkPassphrase,
		accountWasmHash: config.accountWasmHash,
		webauthnVerifierAddress: config.webauthnVerifier,
		relayerUrl: config.relayerUrl,
		storage: new IndexedDBStorage(),
		rpId: window.location.hostname,
		rpName: "ancora",
	});
	return kit;
}

/** Plain-language message for a failed or cancelled passkey or network step. */
export function describeKitError(error: unknown, action: string): string {
	const name = error instanceof Error ? error.name : "";
	if (name === "NotAllowedError" || name === "AbortError") {
		return `The passkey prompt was cancelled, so nothing was ${action}. Try again when you're ready.`;
	}
	const detail = error instanceof Error ? error.message : String(error);
	return `Nothing was ${action}: ${detail}`;
}
