import {
	type ActivityEntry,
	type Currency,
	canEditProfile,
	canManageTreasury,
	checkFunds,
	isNewRecipient,
	moveToReserve,
	type OnchainAccount,
	type OrgAccount,
	type Workspace,
	withdrawFromReserve,
} from "../../domain/account.ts";
import type {
	ChangeOutcome,
	DataSource,
	DataSourceKind,
	PaymentInput,
} from "../../domain/dataSource.ts";
import { type Cents, euros } from "../../domain/money.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import {
	applyChangeDirectly,
	createOrg,
	type GovernanceChange,
	isSetupPhase,
} from "../../domain/rules/governance.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import {
	type ApprovalRequest,
	approveRequest,
	createGovernanceRequest,
	createPaymentRequest,
	declineRequest,
	sealRequest,
} from "../../domain/rules/requests.ts";
import { type KeyValueStorage, notFound, WorkspaceStore } from "./workspaceStore.ts";

export const notAllowed = (message: string) => err(ruleError("not-allowed", message));

export type LocalDataSourceOptions = {
	kind: DataSourceKind;
	storageKey: string;
	storage: KeyValueStorage | null;
	payments: "auto" | "manual";
	seed: (now: number) => Workspace;
	clock?: () => number;
	newId?: () => string;
};

/**
 * Organizations, rules and requests held in a local workspace store; every command runs through
 * the domain engine. The sample adapter uses it as is; the testnet adapter adds the chain.
 */
export class LocalDataSource implements DataSource {
	readonly kind: DataSourceKind;
	readonly identity = null;
	readonly payments: "auto" | "manual";
	readonly supportsReserve: boolean = true;
	protected readonly store: WorkspaceStore;
	protected readonly clock: () => number;
	protected readonly newId: () => string;
	private readonly seed: (now: number) => Workspace;

	constructor(options: LocalDataSourceOptions) {
		this.kind = options.kind;
		this.payments = options.payments;
		this.clock = options.clock ?? Date.now;
		this.newId = options.newId ?? (() => crypto.randomUUID());
		this.seed = options.seed;
		this.store = new WorkspaceStore({
			storage: options.storage,
			storageKey: options.storageKey,
			payments: options.payments,
			clock: this.clock,
			seed: () => options.seed(this.clock()),
		});
	}

	subscribe = (listener: () => void) => this.store.subscribe(listener);
	getSnapshot = () => this.store.getSnapshot();

	async refresh(): Promise<void> {}

	/** Back to the seeded starting state (demo admin). */
	reset(): void {
		this.store.clear();
		this.store.replace(this.seed(this.clock()));
	}

	async createOrganization(input: Parameters<DataSource["createOrganization"]>[0]) {
		return this.addOrganization(input, "EUR", null);
	}

	protected addOrganization(
		input: Parameters<DataSource["createOrganization"]>[0],
		currency: Currency,
		onchain: OnchainAccount | null,
	): Result<string, RuleError> {
		const id = this.newId();
		const created = createOrg({
			id,
			name: input.name.trim(),
			templateId: input.templateId,
			founderId: input.actorId,
			founderRoleId: input.founderRoleId,
		});
		if (!created.ok) return created;
		this.store.addAccount({
			org: created.value,
			currency,
			onchain,
			balance: 0,
			reserve: 0,
			reserveRateBps: 410,
			accountNumber: null,
			logoUrl: null,
			payees: [],
			requests: [],
			activity: [],
		});
		return ok(id);
	}

	async requestPayment(orgId: string, actorId: PersonId, input: PaymentInput) {
		const requestId = this.newId();
		const result = this.store.mutate(orgId, (account) => {
			const funds = checkFunds(account, input.amount);
			if (!funds.ok) return funds;
			const target = input.payee;
			// A recipient entered again with the same account number stays one payee.
			const payee =
				"id" in target
					? account.payees.find((p) => p.id === target.id)
					: (account.payees.find((p) => p.account === target.account.trim()) ?? {
							id: this.newId(),
							name: target.name.trim(),
							account: target.account.trim(),
						});
			if (!payee) return notFound();
			const created = createPaymentRequest(
				account.org,
				{
					id: requestId,
					requesterId: actorId,
					amount: input.amount,
					recipientId: payee.id,
					recipientIsNew: isNewRecipient(account, payee.id),
					note: input.note.trim(),
				},
				this.clock(),
			);
			if (!created.ok) return created;
			const payees = account.payees.some((p) => p.id === payee.id)
				? account.payees
				: [...account.payees, payee];
			return ok({ ...account, payees, requests: [created.value, ...account.requests] });
		});
		return result.ok ? ok(requestId) : result;
	}

	async approve(orgId: string, requestId: string, actorId: PersonId) {
		return this.mutateRequest(orgId, requestId, (account, request) =>
			approveRequest(account.org, request, actorId, this.clock()),
		);
	}

	async seal(orgId: string, requestId: string, actorId: PersonId) {
		return this.mutateRequest(orgId, requestId, (account, request) =>
			sealRequest(account.org, request, actorId, this.clock()),
		);
	}

	async decline(orgId: string, requestId: string, actorId: PersonId) {
		return this.mutateRequest(orgId, requestId, (account, request) =>
			declineRequest(account.org, request, actorId),
		);
	}

	async proposeChange(orgId: string, actorId: PersonId, change: GovernanceChange) {
		let outcome: ChangeOutcome = "requested";
		const result = this.store.mutate(orgId, (account) => {
			if (actorId === account.org.founderId && isSetupPhase(account.org)) {
				const applied = applyChangeDirectly(account.org, actorId, change);
				if (!applied.ok) return applied;
				outcome = "applied";
				const entry = this.entry(actorId, { kind: "governance", change, viaRequest: false });
				return ok({ ...account, org: applied.value, activity: [entry, ...account.activity] });
			}
			const created = createGovernanceRequest(
				account.org,
				{ id: this.newId(), requesterId: actorId, change },
				this.clock(),
			);
			return created.ok
				? ok({ ...account, requests: [created.value, ...account.requests] })
				: created;
		});
		return result.ok ? ok(outcome) : result;
	}

	async moveToReserve(orgId: string, actorId: PersonId, amount: Cents) {
		return this.mutateTreasury(orgId, actorId, amount, "reserve-in", moveToReserve);
	}

	async withdrawFromReserve(orgId: string, actorId: PersonId, amount: Cents) {
		return this.mutateTreasury(orgId, actorId, amount, "reserve-out", withdrawFromReserve);
	}

	async setLogo(orgId: string, actorId: PersonId, logoUrl: string) {
		return this.store.mutate(orgId, (account) => {
			if (!canEditProfile(account.org, actorId)) {
				return notAllowed("Only the organization's highest role can change the logo.");
			}
			const entry = this.entry(actorId, { kind: "logo" });
			return ok({ ...account, logoUrl, activity: [entry, ...account.activity] });
		});
	}

	async executeRequest(
		_orgId: string,
		_requestId: string,
		_actorId: PersonId,
	): Promise<Result<void, RuleError>> {
		return notAllowed("Payments here go out automatically once they are fully approved.");
	}

	/** Sample data: a simulated incoming transfer of €500. */
	async addTestMoney(orgId: string, actorId: PersonId): Promise<Result<void, RuleError>> {
		const amount = euros(500);
		return this.store.mutate(orgId, (account) => {
			const entry = this.entry(actorId, {
				kind: "deposit",
				amount,
				from: "Test money (simulated)",
				txHash: null,
			});
			return ok({
				...account,
				balance: account.balance + amount,
				activity: [entry, ...account.activity],
			});
		});
	}

	protected entry(
		actorId: PersonId | null,
		fields: DistributiveOmit<ActivityEntry>,
	): ActivityEntry {
		return { id: this.newId(), at: this.clock(), actorId, ...fields } as ActivityEntry;
	}

	protected mutateRequest(
		orgId: string,
		requestId: string,
		update: (account: OrgAccount, request: ApprovalRequest) => Result<ApprovalRequest, RuleError>,
	) {
		return this.store.mutate(orgId, (account) => {
			const request = account.requests.find((r) => r.id === requestId);
			if (!request) return notFound();
			const updated = update(account, request);
			if (!updated.ok) return updated;
			return ok({
				...account,
				requests: account.requests.map((r) => (r.id === requestId ? updated.value : r)),
			});
		});
	}

	private mutateTreasury(
		orgId: string,
		actorId: PersonId,
		amount: Cents,
		kind: "reserve-in" | "reserve-out",
		move: (account: OrgAccount, amount: Cents) => Result<OrgAccount, RuleError>,
	) {
		return this.store.mutate(orgId, (account) => {
			if (!canManageTreasury(account.org, actorId)) {
				return notAllowed("Your role can't move money between the account and the Reserve.");
			}
			const moved = move(account, amount);
			if (!moved.ok) return moved;
			const entry = this.entry(actorId, { kind, amount });
			return ok({ ...moved.value, activity: [entry, ...moved.value.activity] });
		});
	}
}

/** Omit the shared id/at/actorId fields from each member of the ActivityEntry union. */
type DistributiveOmit<T> = T extends unknown ? Omit<T, "id" | "at" | "actorId"> : never;
