import type { Workspace } from "./account.ts";
import type { Cents } from "./money.ts";
import type { Result } from "./result.ts";
import type { GovernanceChange } from "./rules/governance.ts";
import type { PersonId, RoleId, RuleError, TemplateId } from "./rules/model.ts";

export type DataSourceKind = "sample" | "testnet";

export type PaymentInput = {
	payee: { id: string } | { name: string; account: string };
	amount: Cents;
	note: string;
};

export type ChangeOutcome = "applied" | "requested";

/**
 * Everything the app reads and does. The sample adapter (labeled demo data) and the testnet
 * adapter implement the same contract, so features never know which one is active.
 * Every command is performed as `actorId`; implementations enforce the rules, not the UI.
 */
export interface DataSource {
	readonly kind: DataSourceKind;
	/**
	 * "auto": a payment goes out as soon as it is fully approved (sample data).
	 * "manual": a signer of the on-chain account signs the transfer with their passkey (testnet).
	 */
	readonly payments: "auto" | "manual";
	/** False until the Reserve runs on the DeFindex vault for this source (task 7). */
	readonly supportsReserve: boolean;
	subscribe(listener: () => void): () => void;
	getSnapshot(): Workspace;
	/** Re-reads balances from the network; a no-op for sample data. */
	refresh(): Promise<void>;

	createOrganization(input: {
		actorId: PersonId;
		name: string;
		templateId: TemplateId;
		founderRoleId: RoleId;
	}): Promise<Result<string, RuleError>>;

	requestPayment(
		orgId: string,
		actorId: PersonId,
		input: PaymentInput,
	): Promise<Result<string, RuleError>>;
	approve(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
	seal(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
	decline(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;

	/** Applies directly during the setup phase, otherwise creates a request. */
	proposeChange(
		orgId: string,
		actorId: PersonId,
		change: GovernanceChange,
	): Promise<Result<ChangeOutcome, RuleError>>;

	moveToReserve(orgId: string, actorId: PersonId, amount: Cents): Promise<Result<void, RuleError>>;
	withdrawFromReserve(
		orgId: string,
		actorId: PersonId,
		amount: Cents,
	): Promise<Result<void, RuleError>>;
	setLogo(orgId: string, actorId: PersonId, logoUrl: string): Promise<Result<void, RuleError>>;

	/** Signs and sends a fully approved payment ("manual" payments only). */
	executeRequest(
		orgId: string,
		requestId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
	/** Testnet money for demos: sent by the demo operator, or simulated for sample data. */
	addTestMoney(orgId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
}
