import {
	type OrgAccount,
	type Person,
	shortAddress,
	type Workspace,
} from "../../domain/account.ts";
import type {
	ContinuitySupport,
	DataSource,
	DealSupport,
	DeviceKeySupport,
	DiscussionSupport,
	FundingSupport,
	Identity,
	IdentitySupport,
	LifelineSupport,
	PotSupport,
	PrivacySupport,
	RampSupport,
	RegistryNameSupport,
	ReleaseSupport,
} from "../../domain/dataSource.ts";
import type { DiscussionEntry } from "../../domain/discussion.ts";
import {
	type PayeeLabel,
	PRIVATE_PAYEE_NAME,
	privateNotesOf,
	revealNotes,
	revealPayees,
} from "../../domain/privateNote.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import { recordError } from "../local/recentErrors.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import type { CommandDeps } from "./commandDeps.ts";
import { createContinuitySupport } from "./continuitySupport.ts";
import { createDealSupport } from "./dealSupport.ts";
import { createDeviceKeySupport } from "./deviceKeySupport.ts";
import { DiscussionThreads } from "./discussionThreads.ts";
import { DueOrderRuns } from "./dueOrderRuns.ts";
import { type HistoryCache, historyCache } from "./historyCache.ts";
import { createIdentitySupport } from "./identitySupport.ts";
import { createLifelineSupport } from "./lifelineSupport.ts";
import { mapOrganization, type OnchainSnapshot } from "./mapOrganization.ts";
import { createOrganizationCommands } from "./organizationCommands.ts";
import {
	type Profile,
	readOrganization,
	readOrganizationsOf,
	readProfiles,
} from "./organizationContract.ts";
import { backfillTransfers, merge } from "./orgHistory.ts";
import { PasskeySession } from "./passkeySession.ts";
import { createPotSupport } from "./pot/potSupport.ts";
import { createPrivateKeys, type PrivateKeys } from "./privacySupport.ts";
import { decryptNote } from "./privateCrypto.ts";
import { labelsFor } from "./privateLabels.ts";
import { createRegistryNameSupport, createReleaseSupport } from "./registrySupport.ts";
import { createRequestCommands } from "./requestCommands.ts";
import { SchedulerAnnouncements } from "./schedulerAnnouncements.ts";
import { postToServer } from "./serverRoutes.ts";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "./sessionCache.ts";
import { SharedReads } from "./sharedReads.ts";
import { type AssetOption, parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";
import { createFundingSupport, createRampSupport } from "./walletSupport.ts";

const EMPTY: Workspace = { people: [], accounts: [] };
/** A session restore slower than this stops blocking the screen; a cached pass stays signed in. */
const RESTORE_TIMEOUT_MS = 8_000;

const failed = (message: string) => err(ruleError("not-allowed", message));
/**
 * Real on Stellar testnet. A person is their passkey-secured smart account; an organization is
 * an `ancora_organization` contract that holds the money, knows its members by address and
 * enforces the approval rules itself. Everything shown is read from the chain; every command
 * is a contract call signed with the person's passkey through their account, fees sponsored.
 * This class is the signed-in session and what it reads; `open` adds the organizations' commands.
 */
export class TestnetDataSource {
	readonly kind = "testnet" as const;
	readonly supportsReserve = true;
	readonly identity: IdentitySupport;
	readonly availableAssets: readonly AssetOption[];
	readonly funding: FundingSupport;
	readonly ramps: RampSupport;
	readonly registryNames: RegistryNameSupport | null;
	readonly releases: ReleaseSupport | null;
	readonly deals: DealSupport | null;
	readonly fxOracle: string | null;
	readonly continuity: ContinuitySupport;
	readonly privacy: PrivacySupport | null;
	readonly pot: PotSupport | null;
	readonly deviceKeys: DeviceKeySupport;
	private readonly privateKeys: PrivateKeys | null;
	/** Accounts as read, before private notes are replaced by what this device can read. */
	private raw: OrgAccount[] = [];
	/** Private notes this device decrypted, and those it tried, so each is opened once. */
	private readonly plainNotes = new Map<string, string>();
	private readonly triedNotes = new Set<string>();
	/** Private recipients' names and notes this device could open, per organization. */
	private readonly payeeLabels = new Map<string, Map<string, PayeeLabel>>();
	readonly lifeline: LifelineSupport;
	readonly discussions: DiscussionSupport = {
		load: (orgIds) => this.loadDiscussions(orgIds),
		post: async (orgId, requestId, actorId, entry) => {
			const text = await this.protectNote(orgId, actorId, entry.text, false);
			if (!text.ok) return text;
			return this.discuss({
				action: "post",
				org: orgId,
				requestId,
				person: actorId,
				...entry,
				text: text.value,
			});
		},
		react: (orgId, requestId, entryId, actorId, reaction) =>
			this.discuss({ action: "react", org: orgId, requestId, entryId, person: actorId, reaction }),
		markAnswered: (orgId, requestId, entryId, actorId) =>
			this.discuss({ action: "answer", org: orgId, requestId, entryId, person: actorId }),
	};
	private readonly config: TestnetConfig;
	private readonly storage: KeyValueStorage | null;
	/** Ledger history read so far, per organization, so each visit scans only what is new. */
	private readonly history: HistoryCache;
	private readonly listeners = new Set<() => void>();
	private snapshot: Workspace = EMPTY;
	private me: Identity | null = null;
	private restoringSession = true;
	private syncingChain = false;
	private profiles = new Map<string, Profile | null>();
	/** The passkey kit's connection and the calls signed through the person's account. */
	private readonly session: PasskeySession;
	/** Organizations this device already announced to the scheduler's index. */
	private readonly announcements: SchedulerAnnouncements;
	/** Discussion threads read so far; screens that show requests ask for them. */
	private readonly threads = new DiscussionThreads();
	/** Due standing orders tried this visit. */
	private readonly orderRuns = new DueOrderRuns();
	/** Reads several screens ask for at once (Lifeline, passkeys). */
	private readonly reads = new SharedReads();

	/** The data source the app uses: the session together with its organizations' commands. */
	static open(storage: KeyValueStorage | null, config: TestnetConfig): DataSource {
		const source = new TestnetDataSource(storage, config);
		const deps: CommandDeps = {
			config,
			availableAssets: source.availableAssets,
			me: () => source.me?.id ?? null,
			account: (orgId) => source.account(orgId),
			invoke: source.session.invoke,
			post: postToServer,
			refresh: () => source.refresh(),
			protectNote: (orgId, actorId, note, onChain) =>
				source.protectNote(orgId, actorId, note, onChain),
			failed,
			recordFailure: (where, error) =>
				recordError(storage, {
					at: Date.now(),
					where,
					message: error instanceof Error ? error.message : String(error),
				}),
		};
		return Object.assign(
			source,
			createRequestCommands(deps),
			createOrganizationCommands({
				...deps,
				protectLabel: (orgId, actorId, subject, label) =>
					source.privateKeys
						? source.privateKeys.protectLabel(orgId, actorId, subject, label)
						: Promise.resolve(ok(label)),
			}),
		);
	}

	private constructor(storage: KeyValueStorage | null, config: TestnetConfig) {
		this.storage = storage;
		this.session = new PasskeySession(config, () => this.refresh());
		this.announcements = new SchedulerAnnouncements(storage);
		this.history = historyCache(storage);
		this.config = config;
		this.availableAssets = parseAssetOptions(config.orgAssets);
		// What this device saw last time shows at once; the chain is read again right after.
		const cached = loadCachedSession(storage);
		if (cached) {
			this.me = cached.me;
			// The cache holds private notes encrypted; they show as private until decrypted again.
			this.raw = [...cached.workspace.accounts];
			// Last visit's discussions show until a screen reads them again.
			for (const account of this.raw) {
				this.threads.remember(account.org.id, account.discussions ?? {});
			}
			this.snapshot = {
				...cached.workspace,
				accounts: this.raw.map((account) => this.reveal(account)),
			};
			this.profiles = new Map(cached.profiles);
			this.restoringSession = false;
		}
		const invoke = this.session.invoke;
		const refresh = () => this.refresh();
		this.funding = createFundingSupport(config, refresh);
		this.ramps = createRampSupport(config);
		const registry = config.stellarRegistryContract;
		this.registryNames = registry
			? createRegistryNameSupport({
					network: config,
					registry,
					invoke,
					post: postToServer,
					failed,
				})
			: null;
		this.releases = registry ? createReleaseSupport({ network: config, registry, failed }) : null;
		this.lifeline = createLifelineSupport({
			config,
			invoke,
			post: postToServer,
			failed,
			refresh,
			remember: (key, ttlMs, load) => this.reads.remember(key, ttlMs, load),
			forget: (prefix) => this.reads.forget(prefix),
		});
		this.deviceKeys = createDeviceKeySupport({
			restore: {
				network: config,
				publishedKey: (person) =>
					this.privateKeys?.reads.publicKey(person) ?? Promise.resolve(null),
				organizations: (person) =>
					this.snapshot.accounts
						.filter((a) => a.org.members.some((m) => m.personId === person))
						.map((a) => a.org.id),
				passkeyKeys: this.session.deviceKeys,
			},
			failed,
			refresh,
		});
		this.fxOracle = config.fxOracle || null;
		this.privateKeys = config.keyringContract
			? createPrivateKeys({
					network: config,
					keyring: config.keyringContract,
					invoke,
					failed,
					refresh: () => this.refresh(),
					members: (orgId) => this.account(orgId)?.org.members.map((m) => m.personId) ?? [],
					readAccount: (orgId) => this.readAccount(orgId),
					passkeyKeys: this.session.deviceKeys,
				})
			: null;
		this.privacy = this.privateKeys?.support ?? null;
		this.pot =
			this.privateKeys && config.potContract
				? createPotSupport({
						network: config,
						config: {
							pot: config.potContract,
							verifier: config.potVerifier,
							auditors: config.potAuditors,
							asset: config.usdcToken,
						},
						reads: this.privateKeys.reads,
						account: (orgId) => this.account(orgId),
						keyring: config.keyringContract,
						invoke,
						failed,
						refresh: () => this.refresh(),
					})
				: null;
		this.continuity = createContinuitySupport({
			network: config,
			verifier: config.sealVerifier,
			invoke,
			failed,
			refresh: () => this.refresh(),
			passkeyKeys: this.session.deviceKeys,
		});
		this.deals = config.dealContract
			? createDealSupport({
					network: config,
					contract: config.dealContract,
					invoke,
					direct: (orgId, actorId) => {
						const account = this.account(orgId);
						return account?.onchain?.setupPhase === true && account.org.founderId === actorId;
					},
					failed,
					refresh: () => this.refresh(),
				})
			: null;
		this.identity = createIdentitySupport({
			registry: config.registryContract,
			session: this.session,
			reads: this.reads,
			restoring: () => this.restoringSession,
			syncing: () => this.syncingChain,
			current: () => this.me,
			become: (id) => this.becomeIdentity(id),
			show: (identity) => {
				this.me = identity;
				this.notify();
			},
			leave: () => {
				this.forget();
				this.notify();
			},
			failed,
		});
		void this.restore();
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.snapshot;

	private notify() {
		for (const listener of this.listeners) listener();
	}

	private async restore() {
		const cachedId = this.me?.id ?? null;
		try {
			// The passkey session check and the chain reads don't depend on each other.
			const connection = this.session.reconnect();
			const [outcome] = await Promise.all([
				Promise.race([
					connection.then((session) => ({ session })),
					new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), RESTORE_TIMEOUT_MS)),
				]),
				cachedId ? this.refresh() : Promise.resolve(),
			]);
			if (outcome === "slow") {
				// A slow network is not a signed-out device: keep what the cache shows and settle
				// once the kit answers.
				void connection
					.then((session) => this.settleSession(session?.contractId ?? null, cachedId))
					.catch(() => this.settleSession(null, cachedId));
				return;
			}
			await this.settleSession(outcome.session?.contractId ?? null, cachedId);
		} catch {
			// No usable session on this device: the sign-in page takes over.
			if (cachedId) this.forget();
		} finally {
			this.restoringSession = false;
			this.notify();
		}
	}

	/** Follows the session the kit found: another pass, the cached one, or none on this device. */
	private async settleSession(sessionId: string | null, cachedId: string | null) {
		if (sessionId && sessionId !== cachedId) {
			await this.becomeIdentity(sessionId);
		} else if (!sessionId && cachedId) {
			// The cache belonged to a session this device no longer has.
			this.forget();
			this.notify();
		}
	}

	private forget() {
		this.me = null;
		this.snapshot = EMPTY;
		this.profiles = new Map();
		this.reads.clear();
		clearCachedSession(this.storage);
	}

	private async becomeIdentity(id: string) {
		this.me = { id, name: null, avatarUrl: null };
		this.notify();
		await this.refresh();
		const profile = this.profiles.get(id) ?? null;
		this.me = { id, name: profile?.name ?? null, avatarUrl: profile?.avatarUrl ?? null };
		this.notify();
	}

	/** Re-reads my organizations from the registry and each organization from its contract. */
	async refresh(): Promise<void> {
		if (!this.me) {
			this.snapshot = EMPTY;
			this.notify();
			return;
		}
		const me = this.me.id;
		this.syncingChain = true;
		this.notify();
		try {
			const orgIds = await readOrganizationsOf(this.config, this.config.registryContract, me);
			const snapshots = await Promise.all(
				orgIds.map((id) => readOrganization(this.config, id, this.history)),
			);
			const everyone = new Set<string>([me]);
			for (const snapshot of snapshots) {
				for (const member of snapshot.members) everyone.add(String(member.address));
			}
			this.profiles = await readProfiles(this.config, this.config.registryContract, [...everyone]);
			this.publish(me, snapshots, everyone);
			void this.revealPrivateNotes(me);
			void this.backfillHistory(me, snapshots, everyone);
			void this.runDueOrders(me);
			void this.announcements.announceNew(orgIds);
		} catch (error) {
			// A failed poll keeps the last snapshot; the health check handles a dead RPC.
			recordError(this.storage, {
				at: Date.now(),
				where: "testnet refresh",
				message: error instanceof Error ? error.message : String(error),
			});
		}
		this.syncingChain = false;
		this.notify();
	}

	/** Runs the due standing orders of my organizations (see dueOrderRuns.ts). */
	private async runDueOrders(me: string): Promise<void> {
		const now = Date.now();
		const due = this.snapshot.accounts.flatMap((account) =>
			(account.standingOrders ?? [])
				.filter((order) => order.active && order.nextAt <= now)
				.map((order) => ({ orgId: account.org.id, id: order.id }))
				.filter((order) => this.orderRuns.canTry(order)),
		);
		if (due.length === 0 || this.me?.id !== me) return;
		const ran = await this.orderRuns.run(
			due,
			async (order) => {
				const result = await postToServer("/api/due", {
					organization: order.orgId,
					orderId: Number(order.id),
				});
				return result.ok ? { ok: true } : { ok: false, message: result.error.message };
			},
			(message) => recordError(this.storage, { at: Date.now(), where: "standing order", message }),
		);
		// Only a run changes what the chain says; after a failure the next poll tries again.
		if (ran) await this.refresh();
	}

	/** The workspace built from what was read, shown now and saved for the next visit. */
	private publish(
		me: string,
		snapshots: readonly OnchainSnapshot[],
		everyone: ReadonlySet<string>,
	): void {
		const orgNames = new Map(snapshots.map((s) => [s.contractId, String(s.info.name)]));
		const symbols = new Map(this.availableAssets.map((a) => [a.token, a.symbol]));
		const accounts: OrgAccount[] = snapshots.map((snapshot) => ({
			...mapOrganization(
				snapshot,
				(who) => orgNames.get(who) ?? this.profiles.get(who)?.name ?? undefined,
				Date.now(),
				(token, onchainSymbol) => symbols.get(token) ?? onchainSymbol,
				this.pot?.asset() ?? null,
			),
			discussions: this.threads.of(snapshot.contractId) ?? {},
		}));
		this.raw = accounts;
		const people: Person[] = [...everyone].map((id) => ({
			id,
			name: this.profiles.get(id)?.name ?? shortAddress(id),
			avatarUrl: this.profiles.get(id)?.avatarUrl ?? null,
		}));
		this.snapshot = {
			people,
			accounts: accounts.map((account) => this.reveal(account)),
		};
		if (this.me?.id === me) {
			// Private notes are cached as stored (encrypted): plain text never reaches local storage.
			saveCachedSession(this.storage, {
				me: this.me,
				workspace: { people, accounts },
				profiles: [...this.profiles.entries()],
			});
		}
	}

	/**
	 * An organization loads with only its newest ledger history; the rest of RPC's week is read
	 * here afterwards, one organization at a time, and the activity grows once it is in.
	 */
	private async backfillHistory(
		me: string,
		snapshots: readonly OnchainSnapshot[],
		everyone: ReadonlySet<string>,
	): Promise<void> {
		const filled: OnchainSnapshot[] = [];
		for (const snapshot of snapshots) {
			const known = this.history.load(snapshot.contractId);
			const tokens = snapshot.assets.map((asset) => String(asset.token));
			const older = known
				? await backfillTransfers(this.config, snapshot.contractId, tokens, known).catch(() => null)
				: null;
			if (!older) {
				filled.push(snapshot);
				continue;
			}
			// A refresh may have read newer ledgers meanwhile; the saved page keeps both.
			const page = merge(older, this.history.load(snapshot.contractId));
			this.history.save(snapshot.contractId, page);
			filled.push({ ...snapshot, transfers: page.transfers });
		}
		if (this.me?.id !== me || filled.every((snapshot, index) => snapshot === snapshots[index])) {
			return;
		}
		this.publish(me, filled, everyone);
		this.notify();
	}

	/**
	 * Decrypts the private notes this device can read and shows them; notes it can't read stay
	 * "Private note". Each note is tried once per visit.
	 */
	private async revealPrivateNotes(me: string): Promise<void> {
		const keys = this.privateKeys;
		if (!keys) return;
		let revealed = false;
		for (const account of this.raw) {
			const notes = privateNotesOf(account).filter((note) => !this.triedNotes.has(note));
			const privatePayees = account.payees.some((p) => p.name === PRIVATE_PAYEE_NAME);
			if (notes.length === 0 && !privatePayees) continue;
			try {
				const orgKeys = await keys.reads.keysFor(account.org.id, me);
				if (privatePayees) {
					this.payeeLabels.set(
						account.org.id,
						await labelsFor(keys.reads, account.org.id, orgKeys),
					);
					revealed = true;
				}
				for (const note of notes) {
					this.triedNotes.add(note);
					const plain = await decryptNote(note, orgKeys);
					if (plain !== null) {
						this.plainNotes.set(note, plain);
						revealed = true;
					}
				}
			} catch (error) {
				recordError(this.storage, {
					at: Date.now(),
					where: "private notes",
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
		if (!revealed || this.me?.id !== me) return;
		this.snapshot = {
			...this.snapshot,
			accounts: this.raw.map((account) => this.reveal(account)),
		};
		this.notify();
	}

	/** The account with the private notes and recipient labels this device opened so far. */
	private reveal(account: OrgAccount): OrgAccount {
		return revealPayees(
			revealNotes(account, this.plainNotes),
			this.payeeLabels.get(account.org.id) ?? new Map(),
		);
	}

	/** Any organization, read from its contract (an auditor's view; they aren't a member). */
	private async readAccount(orgId: string): Promise<OrgAccount> {
		const snapshot = await readOrganization(this.config, orgId, null);
		const symbols = new Map(this.availableAssets.map((a) => [a.token, a.symbol]));
		return {
			...mapOrganization(
				snapshot,
				(who) => this.profiles.get(who)?.name ?? undefined,
				Date.now(),
				(token, onchainSymbol) => symbols.get(token) ?? onchainSymbol,
				this.pot?.asset() ?? null,
			),
			discussions: {},
		};
	}

	/** A note as it is stored: encrypted when the organization keeps references private. */
	private protectNote(orgId: string, actorId: PersonId, text: string, onChain: boolean) {
		return this.privateKeys
			? this.privateKeys.protect(orgId, actorId, text, onChain)
			: Promise.resolve(ok(text));
	}

	/**
	 * Reads the discussions of the organizations that have requests (a discussion hangs on one)
	 * from ancora's server, unless they were read a moment ago.
	 */
	private async loadDiscussions(orgIds: readonly string[]): Promise<Result<void, RuleError>> {
		const withRequests = orgIds.filter(
			(orgId) => (this.raw.find((a) => a.org.id === orgId)?.requests.length ?? 0) > 0,
		);
		const { changed, complete } = await this.threads.load(withRequests);
		if (changed) this.showThreads();
		return complete
			? ok(undefined)
			: failed("The discussion couldn't be loaded from ancora's server. Try again shortly.");
	}

	/** Puts the threads read so far into the workspace on screen. */
	private showThreads(): void {
		this.raw = this.raw.map((account) => ({
			...account,
			discussions: this.threads.of(account.org.id) ?? account.discussions,
		}));
		this.snapshot = {
			...this.snapshot,
			accounts: this.raw.map((account) => this.reveal(account)),
		};
		this.notify();
		// Entries of organizations with private details arrive encrypted.
		if (this.me) void this.revealPrivateNotes(this.me.id);
	}

	/** A change to a discussion; the server answers with the organization's threads afterwards. */
	private async discuss(
		body: Record<string, unknown> & { org: string },
	): Promise<Result<void, RuleError>> {
		const response = await postToServer<{ entries: DiscussionEntry[] }>("/api/discussions", body);
		if (!response.ok) return response;
		this.threads.set(body.org, response.value.entries);
		this.showThreads();
		return ok(undefined);
	}

	private account(orgId: string): OrgAccount | undefined {
		return this.snapshot.accounts.find((a) => a.org.id === orgId);
	}
}
