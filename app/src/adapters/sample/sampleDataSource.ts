import {
	canEditProfile,
	canManageTreasury,
	checkFunds,
	isNewRecipient,
	moveToReserve,
	type OrgAccount,
	settleAccount,
	type Workspace,
	withdrawFromReserve,
} from "../../domain/account.ts";
import type { ChangeOutcome, DataSource, PaymentInput } from "../../domain/dataSource.ts";
import type { Cents } from "../../domain/money.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import {
	applyChangeDirectly,
	createOrg,
	type GovernanceChange,
	isSetupPhase,
} from "../../domain/rules/governance.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import {
	approveRequest,
	createGovernanceRequest,
	createPaymentRequest,
	declineRequest,
	sealRequest,
} from "../../domain/rules/requests.ts";
import { seedWorkspace } from "./seedWorkspace.ts";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "ancora.sample.v1";

const notFound = () =>
	err(
		ruleError("not-found", "This organization or request doesn't exist anymore. Reload the page."),
	);
const notAllowed = (message: string) => err(ruleError("not-allowed", message));

/**
 * Labeled demo data that behaves like the real thing: every command goes through the domain
 * engine. State lives in memory and, when available, in this browser's storage.
 */
export class SampleDataSource implements DataSource {
	readonly kind = "sample" as const;
	private state: Workspace;
	private readonly listeners = new Set<() => void>();
	private readonly storage: KeyValueStorage | null;
	private readonly clock: () => number;
	private readonly newId: () => string;

	constructor(
		storage: KeyValueStorage | null,
		clock: () => number = Date.now,
		newId: () => string = () => crypto.randomUUID(),
	) {
		this.storage = storage;
		this.clock = clock;
		this.newId = newId;
		this.state = this.load() ?? seedWorkspace(this.clock());
		this.state = {
			...this.state,
			accounts: this.state.accounts.map((a) => settleAccount(a, this.clock())),
		};
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.state;

	/** Back to the seeded starting state (demo admin). */
	reset(): void {
		this.storage?.removeItem(STORAGE_KEY);
		this.commit(seedWorkspace(this.clock()));
	}

	async createOrganization(input: Parameters<DataSource["createOrganization"]>[0]) {
		const id = this.newId();
		const created = createOrg({
			id,
			name: input.name.trim(),
			templateId: input.templateId,
			founderId: input.actorId,
			founderRoleId: input.founderRoleId,
		});
		if (!created.ok) return created;
		const account: OrgAccount = {
			org: created.value,
			balance: 0,
			reserve: 0,
			reserveRateBps: 410,
			accountNumber: null,
			logoUrl: null,
			payees: [],
			requests: [],
			activity: [],
		};
		this.commit({ ...this.state, accounts: [...this.state.accounts, account] });
		return ok(id);
	}

	async requestPayment(orgId: string, actorId: PersonId, input: PaymentInput) {
		const requestId = this.newId();
		const result = this.mutate(orgId, (account) => {
			const funds = checkFunds(account, input.amount);
			if (!funds.ok) return funds;
			const target = input.payee;
			const payee =
				"id" in target
					? account.payees.find((p) => p.id === target.id)
					: { id: this.newId(), name: target.name.trim(), account: target.account.trim() };
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
		const result = this.mutate(orgId, (account) => {
			if (actorId === account.org.founderId && isSetupPhase(account.org)) {
				const applied = applyChangeDirectly(account.org, actorId, change);
				if (!applied.ok) return applied;
				outcome = "applied";
				const entry = {
					id: this.newId(),
					at: this.clock(),
					actorId,
					kind: "governance" as const,
					change,
					viaRequest: false,
				};
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
		return this.mutate(orgId, (account) => {
			if (!canEditProfile(account.org, actorId)) {
				return notAllowed("Only the organization's highest role can change the logo.");
			}
			const entry = { id: this.newId(), at: this.clock(), actorId, kind: "logo" as const };
			return ok({ ...account, logoUrl, activity: [entry, ...account.activity] });
		});
	}

	private mutateTreasury(
		orgId: string,
		actorId: PersonId,
		amount: Cents,
		kind: "reserve-in" | "reserve-out",
		move: (account: OrgAccount, amount: Cents) => Result<OrgAccount, RuleError>,
	) {
		return this.mutate(orgId, (account) => {
			if (!canManageTreasury(account.org, actorId)) {
				return notAllowed("Your role can't move money between the account and the Reserve.");
			}
			const moved = move(account, amount);
			if (!moved.ok) return moved;
			const entry = { id: this.newId(), at: this.clock(), actorId, kind, amount };
			return ok({ ...moved.value, activity: [entry, ...moved.value.activity] });
		});
	}

	private mutateRequest(
		orgId: string,
		requestId: string,
		update: (
			account: OrgAccount,
			request: OrgAccount["requests"][number],
		) => Result<OrgAccount["requests"][number], RuleError>,
	) {
		return this.mutate(orgId, (account) => {
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

	/** Applies an update to one org, settles due requests, then persists and notifies. */
	private mutate(
		orgId: string,
		update: (account: OrgAccount) => Result<OrgAccount, RuleError>,
	): Result<void, RuleError> {
		const account = this.state.accounts.find((a) => a.org.id === orgId);
		if (!account) return notFound();
		const updated = update(account);
		if (!updated.ok) return updated;
		const settled = settleAccount(updated.value, this.clock());
		this.commit({
			...this.state,
			accounts: this.state.accounts.map((a) => (a.org.id === orgId ? settled : a)),
		});
		return ok(undefined);
	}

	private commit(next: Workspace) {
		this.state = next;
		this.persist();
		for (const listener of this.listeners) listener();
	}

	private load(): Workspace | null {
		try {
			const raw = this.storage?.getItem(STORAGE_KEY);
			const parsed: unknown = raw ? JSON.parse(raw) : null;
			return isWorkspace(parsed) ? parsed : null;
		} catch {
			// Blocked storage or a corrupt entry: the defined fallback is the fresh seed.
			return null;
		}
	}

	private persist() {
		try {
			this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
		} catch {
			// Storage full or blocked (e.g. private mode): the demo keeps working in memory for this tab.
		}
	}
}

/** Shallow shape check; the stored value was written by this class, so deep validation isn't needed. */
function isWorkspace(value: unknown): value is Workspace {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as Partial<Workspace>).people) &&
		Array.isArray((value as Partial<Workspace>).accounts)
	);
}
