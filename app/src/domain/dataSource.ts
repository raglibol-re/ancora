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

/** Who the app acts as: a person's address on Stellar (their passkey-secured account). */
export type Identity = { id: PersonId; name: string | null; avatarUrl: string | null };

export type ProfileInput = { name: string; avatarUrl: string | null };

/**
 * Sign-in for sources where the person is a real on-chain identity. The passkey is the login:
 * creating one deploys the person's account; signing in reuses a passkey on this device.
 */
export interface IdentitySupport {
	/** True while a stored session is being restored after load. */
	restoring(): boolean;
	current(): Identity | null;
	createIdentity(name: string): Promise<Result<Identity, RuleError>>;
	signIn(): Promise<Result<Identity, RuleError>>;
	signOut(): Promise<void>;
	/** Name and picture shown next to this person in every organization. */
	saveProfile(profile: ProfileInput): Promise<Result<void, RuleError>>;
	/** Stores a small picture and returns its public URL, to be saved with the profile. */
	uploadAvatar(image: Blob): Promise<Result<string, RuleError>>;
}

/**
 * Everything the app reads and does. The sample adapter (labeled demo data) and the testnet
 * adapter implement the same contract, so features never know which one is active.
 * Every command is performed as `actorId`; implementations enforce the rules, not the UI.
 */
export interface DataSource {
	readonly kind: DataSourceKind;
	/** Null for sample data, where "Viewing as" picks the person instead of a passkey. */
	readonly identity: IdentitySupport | null;
	/** False until the Reserve runs on the DeFindex vault for this source (task 7). */
	readonly supportsReserve: boolean;
	subscribe(listener: () => void): () => void;
	getSnapshot(): Workspace;
	/** Re-reads balances and organizations from the network; a no-op for sample data. */
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

	/** Sends a fully approved request whose objection window has passed. */
	executeRequest(
		orgId: string,
		requestId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
	/** Testnet money for demos: sent by the demo operator, or simulated for sample data. */
	addTestMoney(orgId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
}
