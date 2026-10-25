import { StrKey } from "@stellar/stellar-sdk";
import { tokenBalance } from "../../../shared/tokenBalance.ts";
import { recordExecutedPayment } from "../../domain/account.ts";
import type { DataSource, PaymentInput } from "../../domain/dataSource.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import { LocalDataSource, notAllowed } from "../local/localDataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { samplePeople } from "../sample/seedWorkspace.ts";
import { describeKitError, passkeyKit } from "./passkeyKit.ts";
import { passkeyUserName } from "./passkeyUserName.ts";
import type { TestnetConfig } from "./testnetConfig.ts";

const STROOPS_PER_CENT = 100_000n; // USDC has 7 decimals

const failed = (message: string) => err(ruleError("not-allowed", message));

/**
 * Real on Stellar testnet: each organization is a smart account (OpenZeppelin, via
 * smart-account-kit) secured by passkeys, fees are sponsored by /api/relay, balances and
 * payments are on-chain USDC. The approval rules still run in the app engine until they move
 * on-chain (task 6); approving asks for a passkey to confirm presence.
 */
export class TestnetDataSource extends LocalDataSource {
	override readonly supportsReserve = false;
	private readonly config: TestnetConfig;

	constructor(storage: KeyValueStorage | null, config: TestnetConfig) {
		super({
			kind: "testnet",
			storageKey: "ancora.testnet.v1",
			storage,
			payments: "manual",
			seed: () => ({ people: samplePeople, accounts: [] }),
		});
		this.config = config;
	}

	private get kit() {
		return passkeyKit(this.config);
	}

	override async createOrganization(input: Parameters<DataSource["createOrganization"]>[0]) {
		let wallet: Awaited<ReturnType<typeof this.kit.createWallet>>;
		try {
			// The passkey is named after the organization it secures.
			wallet = await this.kit.createWallet("ancora", passkeyUserName(input.name), {
				autoSubmit: true,
			});
		} catch (error) {
			return failed(describeKitError(error, "created"));
		}
		if (wallet.submitResult && !wallet.submitResult.success) {
			return failed(
				`The account couldn't be created on Stellar: ${wallet.submitResult.error.message}`,
			);
		}
		const created = this.addOrganization(input, "USD", {
			contractId: wallet.contractId,
			signers: [{ personId: input.actorId, credentialId: wallet.credentialId }],
		});
		await this.refresh();
		return created;
	}

	override async requestPayment(orgId: string, actorId: PersonId, input: PaymentInput) {
		const address = "account" in input.payee ? input.payee.account.trim() : null;
		if (address && !StrKey.isValidEd25519PublicKey(address) && !StrKey.isValidContract(address)) {
			return failed("On testnet, enter the recipient's Stellar address (starts with G or C).");
		}
		const present = await this.confirmPresence("requested");
		return present.ok ? super.requestPayment(orgId, actorId, input) : present;
	}

	override async approve(orgId: string, requestId: string, actorId: PersonId) {
		const present = await this.confirmPresence("approved");
		return present.ok ? super.approve(orgId, requestId, actorId) : present;
	}

	override async decline(orgId: string, requestId: string, actorId: PersonId) {
		const present = await this.confirmPresence("declined");
		return present.ok ? super.decline(orgId, requestId, actorId) : present;
	}

	override async proposeChange(orgId: string, actorId: PersonId, change: GovernanceChange) {
		const present = await this.confirmPresence("changed");
		return present.ok ? super.proposeChange(orgId, actorId, change) : present;
	}

	override async moveToReserve(): Promise<Result<void, RuleError>> {
		return notAllowed("The Reserve isn't connected on testnet yet. It arrives with DeFindex.");
	}

	override async withdrawFromReserve(): Promise<Result<void, RuleError>> {
		return notAllowed("The Reserve isn't connected on testnet yet. It arrives with DeFindex.");
	}

	/** The signer's passkey signs the USDC transfer; the relayer pays the fee. */
	override async executeRequest(orgId: string, requestId: string, actorId: PersonId) {
		const account = this.store.account(orgId);
		const request = account?.requests.find((r) => r.id === requestId);
		if (!account?.onchain || !request || request.kind !== "payment" || request.status !== "ready") {
			return failed("This payment isn't ready to be sent.");
		}
		const signer = account.onchain.signers.find((s) => s.personId === actorId);
		if (!signer) return failed("Only a signer of this account can send the payment.");
		const payee = account.payees.find((p) => p.id === request.recipientId);
		if (!payee) return failed("The recipient of this payment is missing.");
		try {
			await this.kit.connectWallet({
				contractId: account.onchain.contractId,
				credentialId: signer.credentialId,
			});
			const result = await this.kit.transfer(
				this.config.usdcToken,
				payee.account,
				request.amount / 100,
			);
			if (!result.success) return failed(`The payment failed on Stellar: ${result.error.message}`);
			this.store.mutate(orgId, (current) =>
				ok(recordExecutedPayment(current, requestId, result.hash, this.clock())),
			);
		} catch (error) {
			return failed(describeKitError(error, "sent"));
		}
		await this.refresh();
		return ok(undefined);
	}

	/** Asks the demo operator (/api/test-money) to send test USDC to the organization's account. */
	override async addTestMoney(orgId: string, actorId: PersonId) {
		const account = this.store.account(orgId);
		if (!account?.onchain) return failed("This organization has no account on Stellar yet.");
		const response = await fetch("/api/test-money", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ contractId: account.onchain.contractId }),
		}).catch(() => null);
		const body = (await response?.json().catch(() => null)) as {
			success?: boolean;
			error?: string;
			data?: { hash: string; amountStroops: string };
		} | null;
		if (!body?.success || !body.data) {
			return failed(body?.error ?? "The test-money service is unreachable. Try again shortly.");
		}
		const { hash, amountStroops } = body.data;
		this.store.mutate(orgId, (current) =>
			ok({
				...current,
				activity: [
					this.entry(actorId, {
						kind: "deposit",
						amount: Number(BigInt(amountStroops) / STROOPS_PER_CENT),
						from: "Test money from the demo operator",
						txHash: hash,
					}),
					...current.activity,
				],
			}),
		);
		await this.refresh();
		return ok(undefined);
	}

	/** Reads every on-chain account's USDC balance (stroops → cents, rounded down). */
	override async refresh(): Promise<void> {
		const accounts = this.getSnapshot().accounts.filter((a) => a.onchain);
		const balances = await Promise.all(
			accounts.map(async (a) =>
				tokenBalance(this.config, this.config.usdcToken, a.onchain?.contractId ?? "").catch(
					() => null,
				),
			),
		);
		accounts.forEach((account, index) => {
			const stroops = balances[index];
			if (stroops === null || stroops === undefined) return;
			this.store.mutate(account.org.id, (current) =>
				ok({ ...current, balance: Number(stroops / STROOPS_PER_CENT) }),
			);
		});
	}

	/**
	 * Confirms someone is at the device with any of this site's passkeys before an action that is
	 * recorded in the app. On-chain enforcement of approvals comes with task 6.
	 */
	private async confirmPresence(action: string): Promise<Result<void, RuleError>> {
		try {
			await this.kit.authenticatePasskey();
			return ok(undefined);
		} catch (error) {
			return failed(describeKitError(error, action));
		}
	}
}
