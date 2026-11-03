import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { IndexedDBStorage, SmartAccountErrorCode, SmartAccountKit } from "smart-account-kit";
import { withRpcTimeout } from "../../../shared/rpcServer.ts";
import type { TestnetConfig } from "./testnetConfig.ts";

let kit: SmartAccountKit | null = null;

// The WebAuthn PRF extension; @simplewebauthn's extension type predates it, the browser reads it.
const ASK_PRF = { prf: {} };

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
		// The kit verifies a wallet's creation through an indexer before it connects a passkey;
		// ancora's own index (next to the relayer) answers, since Mercury's leaves the birth empty.
		indexerUrl: new URL("wallet-index", new URL(config.relayerUrl, window.location.origin)).href,
		storage: new IndexedDBStorage(),
		rpId: window.location.hostname,
		rpName: "ancora",
		// New passkeys are asked to support PRF, which some authenticators only enable at
		// creation; the device keys are derived from it (passkeyKeys.ts).
		webAuthn: {
			startRegistration: ({ optionsJSON, useAutoRegister }) =>
				startRegistration({
					optionsJSON: { ...optionsJSON, extensions: { ...optionsJSON.extensions, ...ASK_PRF } },
					useAutoRegister,
				}),
			startAuthentication,
		},
	});
	withRpcTimeout(kit.rpc);
	return kit;
}

/** Plain-language message for a failed or cancelled passkey or network step. */
export function describeKitError(error: unknown, action: string): string {
	const name = error instanceof Error ? error.name : "";
	if (name === "NotAllowedError" || name === "AbortError") {
		return `The passkey prompt was cancelled, so nothing was ${action}. Try again when you're ready.`;
	}
	if (isKitError(error, SmartAccountErrorCode.WALLET_PROVENANCE_UNVERIFIED)) {
		return `This passkey's account on Stellar couldn't be confirmed yet, so nothing was ${action}. Wait a minute and try again; if it keeps failing, the account wasn't created with ancora.`;
	}
	if (isTimeout(error)) return RPC_TIMED_OUT;
	const detail = error instanceof Error ? error.message : String(error);
	return `Nothing was ${action}: ${detail}`;
}

/** A timeout may hit after the transaction was sent, so this doesn't claim nothing happened. */
export const RPC_TIMED_OUT =
	"Stellar's network didn't answer in time, so this may not have gone through. Reload in a moment and check before you try again.";

/** An RPC request that ran past its timeout (shared/rpcServer.ts); axios marks it ECONNABORTED. */
function isTimeout(error: unknown): boolean {
	return error instanceof Error && (error as { code?: unknown }).code === "ECONNABORTED";
}

function isKitError(error: unknown, code: SmartAccountErrorCode): boolean {
	return error instanceof Error && (error as { code?: unknown }).code === code;
}
