import { type OrgAccount, settleAccount, type Workspace } from "../../domain/account.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const notFound = () =>
	err(
		ruleError("not-found", "This organization or request doesn't exist anymore. Reload the page."),
	);

/**
 * In-memory workspace with optional browser persistence and change notifications, the shape
 * React reads via useSyncExternalStore. Every update settles due requests through the domain.
 */
export class WorkspaceStore {
	private state: Workspace;
	private readonly listeners = new Set<() => void>();
	private readonly storage: KeyValueStorage | null;
	private readonly storageKey: string;
	private readonly payments: "auto" | "manual";
	private readonly clock: () => number;

	constructor(options: {
		storage: KeyValueStorage | null;
		storageKey: string;
		payments: "auto" | "manual";
		clock: () => number;
		seed: () => Workspace;
	}) {
		this.storage = options.storage;
		this.storageKey = options.storageKey;
		this.payments = options.payments;
		this.clock = options.clock;
		const initial = this.load() ?? options.seed();
		this.state = { ...initial, accounts: initial.accounts.map((a) => this.settle(a)) };
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.state;

	account(orgId: string): OrgAccount | undefined {
		return this.state.accounts.find((a) => a.org.id === orgId);
	}

	/** Applies an update to one org, settles due requests, then persists and notifies. */
	mutate(
		orgId: string,
		update: (account: OrgAccount) => Result<OrgAccount, RuleError>,
	): Result<void, RuleError> {
		const account = this.account(orgId);
		if (!account) return notFound();
		const updated = update(account);
		if (!updated.ok) return updated;
		const settled = this.settle(updated.value);
		this.commit({
			...this.state,
			accounts: this.state.accounts.map((a) => (a.org.id === orgId ? settled : a)),
		});
		return ok(undefined);
	}

	addAccount(account: OrgAccount): void {
		this.commit({ ...this.state, accounts: [...this.state.accounts, account] });
	}

	replace(next: Workspace): void {
		this.commit(next);
	}

	clear(): void {
		this.storage?.removeItem(this.storageKey);
	}

	private settle(account: OrgAccount): OrgAccount {
		return settleAccount(account, this.clock(), this.payments);
	}

	private commit(next: Workspace) {
		this.state = next;
		this.persist();
		for (const listener of this.listeners) listener();
	}

	private load(): Workspace | null {
		try {
			const raw = this.storage?.getItem(this.storageKey);
			const parsed: unknown = raw ? JSON.parse(raw) : null;
			return isWorkspace(parsed) ? parsed : null;
		} catch {
			// Blocked storage or a corrupt entry: the defined fallback is the fresh seed.
			return null;
		}
	}

	private persist() {
		try {
			this.storage?.setItem(this.storageKey, JSON.stringify(this.state));
		} catch {
			// Storage full or blocked (e.g. private mode): the app keeps working in memory for this tab.
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
