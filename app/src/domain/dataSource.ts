import type { Workspace } from "./account.ts";
import type { EntryKind, Reaction } from "./discussion.ts";
import type { ClaimStatus, LifelineOverview, RecoveryPlan } from "./lifeline.ts";
import type { Cents, Currency } from "./money.ts";
import type { Result } from "./result.ts";
import type { GovernanceChange } from "./rules/governance.ts";
import type { Asset, PersonId, RoleId, RuleError, TemplateId } from "./rules/model.ts";
import type { PaymentRequest } from "./rules/requests.ts";

export type DataSourceKind = "sample" | "testnet";

export type PaymentInput = {
	payee: { id: string } | { name: string; account: string };
	/** The accepted asset the payment goes out in. */
	token: string;
	amount: Cents;
	note: string;
	/** Budget category the payment counts against (one of the rules' budgets). */
	category?: string | null;
	/** Secure handover: hold the money after approval until both sides confirm. */
	escrow?: boolean;
};

/** A held handover as its recipient sees it, without being a member of the organization. */
export type EscrowView = {
	orgName: string;
	currency: Currency;
	request: PaymentRequest;
};

export type ChangeOutcome = "applied" | "requested";

/** An asset a new organization may accept, with a label for pickers. */
export type AssetOption = Asset & { label: string };

/** A Stellar wallet the person connected to fund an organization (Freighter, Hana, xBull, Albedo). */
export type ConnectedWallet = { address: string; walletName: string };

/**
 * Money from the person's own wallet into an organization. Wallets' plain "send" can't target a
 * contract address, so the source builds the token transfer and the wallet signs it.
 */
export interface FundingSupport {
	/**
	 * Opens the wallet picker. When called from inside a modal `<dialog>`, pass an element inside
	 * it as `container`: everything outside an open dialog is inert, so a picker mounted on the
	 * body could not be clicked.
	 */
	connectWallet(container?: HTMLElement): Promise<Result<ConnectedWallet, RuleError>>;
	disconnectWallet(): Promise<void>;
	/** What the wallet holds of `token`, in cents. */
	walletBalance(token: string, holder: string): Promise<Cents>;
	/** "USDC:GATALT…" for a classic asset, so the right trustline can be named. */
	assetName(token: string): Promise<string>;
	/** Transfers `amount` of `token` from the wallet to the organization; resolves to the tx hash. */
	depositFromWallet(
		orgId: string,
		token: string,
		from: string,
		amount: Cents,
	): Promise<Result<string, RuleError>>;
}

/** A bank deposit or withdrawal started with an anchor; `url` is the anchor's own form. */
export type AnchorSession = { id: string; url: string };

/** The anchor's record of one deposit or withdrawal, in fields the UI can show. */
export type AnchorTransaction = {
	id: string;
	kind: "deposit" | "withdrawal";
	/** SEP-24 status, e.g. "incomplete", "pending_user_transfer_start", "completed". */
	status: string;
	/** Decimal strings as the anchor reports them; null until known. */
	amountIn: string | null;
	amountOut: string | null;
	message: string | null;
	stellarTxHash: string | null;
	/** Withdrawals: the account and memo the organization must pay the anchor with. */
	withdrawTo: { account: string; memo: string } | null;
};

export type AnchorInfo = {
	homeDomain: string;
	/** Accepted tokens (contract ids) the anchor can bring in or pay out. */
	depositable: readonly string[];
	withdrawable: readonly string[];
};

/**
 * Money between a bank and Stellar through an anchor (SEP-24). The anchor hosts the bank form;
 * the person's wallet signs a challenge to prove who is asking. Deposits land in the wallet and
 * move on to the organization with `FundingSupport`; a withdrawal ends in a payment request from
 * the organization to the anchor, which then pays the bank account.
 */
export interface RampSupport {
	info(): Promise<Result<AnchorInfo, RuleError>>;
	startDeposit(token: string, wallet: string): Promise<Result<AnchorSession, RuleError>>;
	startWithdrawal(token: string, wallet: string): Promise<Result<AnchorSession, RuleError>>;
	transaction(wallet: string, id: string): Promise<Result<AnchorTransaction, RuleError>>;
}

/**
 * Lifeline recovery (see domain/lifeline.ts). Commands are signed by `actorId` where the contract
 * requires it: the person for their plan and for cancelling, a guardian for starting and
 * confirming; finishing needs no signature and is submitted by ancora's server.
 */
export interface LifelineSupport {
	overview(personId: PersonId): Promise<Result<LifelineOverview, RuleError>>;
	/** Plan and claim of any pass, for the new pass that watches its own recovery. */
	claimOf(personId: PersonId): Promise<Result<ClaimStatus, RuleError>>;
	setPlan(personId: PersonId, plan: RecoveryPlan): Promise<Result<void, RuleError>>;
	clearPlan(personId: PersonId): Promise<Result<void, RuleError>>;
	startClaim(
		personId: PersonId,
		guardianId: PersonId,
		successorId: PersonId,
	): Promise<Result<void, RuleError>>;
	approveClaim(personId: PersonId, guardianId: PersonId): Promise<Result<void, RuleError>>;
	cancelClaim(personId: PersonId): Promise<Result<void, RuleError>>;
	finishClaim(
		personId: PersonId,
	): Promise<Result<{ successor: PersonId; recovered: string[]; skipped: string[] }, RuleError>>;
}

/** Discussion on approval requests; the entries themselves arrive with the workspace snapshot. */
export interface DiscussionSupport {
	post(
		orgId: string,
		requestId: string,
		actorId: PersonId,
		entry: { kind: EntryKind; text: string },
	): Promise<Result<void, RuleError>>;
	/** Sets, changes or (null) clears the person's reaction on an entry. */
	react(
		orgId: string,
		requestId: string,
		entryId: string,
		actorId: PersonId,
		reaction: Reaction | null,
	): Promise<Result<void, RuleError>>;
	/** The requester closes a question on their request. */
	markAnswered(
		orgId: string,
		requestId: string,
		entryId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
}

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
	/** How many passkeys can sign for the account (the everyday signers). */
	passkeyCount(): Promise<Result<number, RuleError>>;
	/**
	 * Creates another passkey (security key, this device, or another phone through the browser's
	 * QR flow) and adds it as a signer, signed by the current passkey.
	 */
	addPasskey(label: string): Promise<Result<void, RuleError>>;
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
	/** The stablecoins an organization may accept on this source. */
	readonly availableAssets: readonly AssetOption[];
	/** Funding from the person's own Stellar wallet; null for sample data. */
	readonly funding: FundingSupport | null;
	/** Bank deposits and withdrawals through a Stellar anchor; null for sample data. */
	readonly ramps: RampSupport | null;
	/** Lifeline recovery: guardians, claims, handover of positions (simulated on sample data). */
	readonly lifeline: LifelineSupport;
	readonly discussions: DiscussionSupport;
	subscribe(listener: () => void): () => void;
	getSnapshot(): Workspace;
	/** Re-reads balances and organizations from the network; a no-op for sample data. */
	refresh(): Promise<void>;

	createOrganization(input: {
		actorId: PersonId;
		name: string;
		templateId: TemplateId;
		founderRoleId: RoleId;
		/** The currency the rules are written in. */
		baseCurrency: Currency;
		/** Tokens from `availableAssets` the organization accepts from the start. */
		assets: readonly string[];
	}): Promise<Result<string, RuleError>>;

	requestPayment(
		orgId: string,
		actorId: PersonId,
		input: PaymentInput,
	): Promise<Result<string, RuleError>>;
	approve(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
	/** One side of a secure handover confirms; with both confirmations the money goes out. */
	confirmEscrow(
		orgId: string,
		requestId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
	/** The sender's side frees the held money. */
	cancelEscrow(
		orgId: string,
		requestId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
	/** A held handover by organization and request, readable by its recipient. */
	escrowOf(orgId: string, requestId: string): Promise<Result<EscrowView, RuleError>>;
	seal(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;
	decline(orgId: string, requestId: string, actorId: PersonId): Promise<Result<void, RuleError>>;

	/** Applies directly during the setup phase, otherwise creates a request. */
	proposeChange(
		orgId: string,
		actorId: PersonId,
		change: GovernanceChange,
	): Promise<Result<ChangeOutcome, RuleError>>;

	moveToReserve(
		orgId: string,
		actorId: PersonId,
		token: string,
		amount: Cents,
	): Promise<Result<void, RuleError>>;
	withdrawFromReserve(
		orgId: string,
		actorId: PersonId,
		token: string,
		amount: Cents,
	): Promise<Result<void, RuleError>>;
	setLogo(orgId: string, actorId: PersonId, logoUrl: string): Promise<Result<void, RuleError>>;

	/** Sends a fully approved request whose objection window has passed. */
	executeRequest(
		orgId: string,
		requestId: string,
		actorId: PersonId,
	): Promise<Result<void, RuleError>>;
	/** Testnet money in one asset for demos: sent by the demo operator, or simulated for sample data. */
	addTestMoney(orgId: string, actorId: PersonId, token: string): Promise<Result<void, RuleError>>;
	/**
	 * Whether `recipient` can receive `token` right now (on Stellar: the address exists and holds
	 * a trustline for exactly that asset). Sample data accepts everything.
	 */
	canReceive(token: string, recipient: string): Promise<Result<void, RuleError>>;
}
