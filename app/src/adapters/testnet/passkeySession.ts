import type { xdr } from "@stellar/stellar-sdk";
import { withWork } from "../../domain/pendingWork.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";
import { CONTRACT_ERROR_MESSAGES } from "./mapOrganization.ts";
import { passkeyKeys } from "./passkeyKeys.ts";
import { describeKitError, passkeyKit } from "./passkeyKit.ts";
import type { TestnetConfig } from "./testnetConfig.ts";

export const SESSION_ENDED =
	"Your passkey session on this device has ended, so nothing was done. Sign out and sign in again with your passkey.";

/** Shown on the working bar while the passkey signs and the transaction travels to Stellar. */
export const SIGNING = "Sending to Stellar… confirm with your passkey if asked.";

const failed = (message: string) => err(ruleError("not-allowed", message));

/** Turns the kit's "Error(Contract, #6)" into the organization contract's plain-language text. */
function contractMessage(message: string): string {
	const code = /Error\(Contract, #(\d+)\)/.exec(message)?.[1];
	return (code && CONTRACT_ERROR_MESSAGES[Number(code)]) || `Nothing was changed: ${message}`;
}

/**
 * The person's passkey-secured account on this device: its connection to the passkey kit and
 * the contract calls signed through it (fees sponsored).
 */
export class PasskeySession {
	private readonly config: TestnetConfig;
	/** Reads the chain again after a call changed it. */
	private readonly refresh: () => Promise<void>;
	/**
	 * The kit's reconnect started when the page loads. The app shows the cached session at once,
	 * so a signed action can come before the kit is ready; it waits for this instead.
	 */
	private connecting: Promise<unknown> = Promise.resolve();

	constructor(config: TestnetConfig, refresh: () => Promise<void>) {
		this.config = config;
		this.refresh = refresh;
	}

	get kit() {
		return passkeyKit(this.config);
	}

	/** Asks the kit for the session this device had; signed calls wait for the answer. */
	reconnect() {
		const connection = this.kit.connectWallet();
		this.connecting = connection.catch(() => null);
		return connection;
	}

	/** Waits for the kit's reconnect after a page load; tries once more if it didn't connect. */
	async ensureConnected(): Promise<boolean> {
		if (this.kit.isConnected) return true;
		await withWork("Reconnecting your passkey…", async () => {
			await this.connecting;
			if (!this.kit.isConnected) await this.kit.connectWallet().catch(() => null);
		});
		return this.kit.isConnected;
	}

	/**
	 * This pass's device keys derived from its passkey (PRF), or null when it can't. Waits for
	 * the kit's reconnect first: without its credential id the browser is asked for any passkey
	 * of the site, which can be the wrong one, or none that answers.
	 */
	readonly deviceKeys = async () => {
		await this.ensureConnected();
		return passkeyKeys(this.kit.credentialId);
	};

	/** Calls a contract through the person's account (passkey-signed, fee-sponsored). */
	readonly invoke = async (
		target: string,
		fn: string,
		args: xdr.ScVal[],
		describeContractError: (message: string) => string = contractMessage,
	): Promise<Result<void, RuleError>> => {
		if (!(await this.ensureConnected())) return failed(SESSION_ENDED);
		try {
			const result = await withWork(SIGNING, () => this.kit.executeAndSubmit(target, fn, args));
			if (!result.success) return failed(describeContractError(result.error.message));
		} catch (error) {
			return failed(describeKitError(error, "done"));
		}
		await this.refresh();
		return ok(undefined);
	};
}
