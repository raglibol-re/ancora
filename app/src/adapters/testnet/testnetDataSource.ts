import type { OrgAccount, Workspace } from "../../domain/account.ts";
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
import { err, ok } from "../../domain/result.ts";
import { type PersonId, ruleError } from "../../domain/rules/model.ts";
import { recordError } from "../local/recentErrors.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import type { CommandDeps } from "./commandDeps.ts";
import { createContinuitySupport } from "./continuitySupport.ts";
import { createDealSupport } from "./dealSupport.ts";
import { createDeviceKeySupport } from "./deviceKeySupport.ts";
import { createDiscussionSupport } from "./discussionSupport.ts";
import { DiscussionThreads } from "./discussionThreads.ts";
import { DueOrderRuns } from "./dueOrderRuns.ts";
import { backfillHistory } from "./historyBackfill.ts";
import { type HistoryCache, historyCache } from "./historyCache.ts";
import { createIdentitySupport } from "./identitySupport.ts";
import { createLifelineSupport } from "./lifelineSupport.ts";
import { createOrganizationCommands } from "./organizationCommands.ts";
import {
	type Profile,
	readOrganization,
	readOrganizationsOf,
	readProfiles,
} from "./organizationContract.ts";
import { PasskeySession } from "./passkeySession.ts";
import { createPotSupport } from "./pot/potSupport.ts";
import { createPrivateKeys, type PrivateKeys } from "./privacySupport.ts";
import { createRegistryNameSupport, createReleaseSupport } from "./registrySupport.ts";
import { createRequestCommands } from "./requestCommands.ts";
import { RevealedDetails } from "./revealedDetails.ts";
import { SchedulerAnnouncements } from "./schedulerAnnouncements.ts";
import { postToServer } from "./serverRoutes.ts";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "./sessionCache.ts";
import { restoreSession } from "./sessionRestore.ts";
import { SharedReads } from "./sharedReads.ts";
import { type AssetOption, parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";
import { createFundingSupport, createRampSupport } from "./walletSupport.ts";
import { accountFromChain, type Reading, workspaceFromChain } from "./workspaceFromChain.ts";

const EMPTY: Workspace = { people: [], accounts: [] };

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
	/** The private notes and recipient names this device could open. */
	private readonly details = new RevealedDetails(
		() => this.privateKeys?.reads ?? null,
		(error) => this.record("private notes", error),
	);
	readonly lifeline: LifelineSupport;
	readonly discussions: DiscussionSupport;
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
			recordFailure: (where, error) => source.record(where, error),
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
				accounts: this.raw.map((account) => this.details.reveal(account)),
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
			leave: () => this.forget(),
			failed,
		});
		this.discussions = createDiscussionSupport({
			threads: this.threads,
			hasRequests: (orgId) => (this.raw.find((a) => a.org.id === orgId)?.requests.length ?? 0) > 0,
			show: () => this.showThreads(),
			protectNote: (orgId, actorId, note, onChain) =>
				this.protectNote(orgId, actorId, note, onChain),
			failed,
		});
		void restoreSession({
			cachedId: this.me?.id ?? null,
			reconnect: () => this.session.reconnect().then((found) => found?.contractId ?? null),
			refresh,
			become: (id) => this.becomeIdentity(id),
			forget: () => this.forget(),
		}).finally(() => {
			this.restoringSession = false;
			this.notify();
		});
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.snapshot;

	private notify() {
		for (const listener of this.listeners) listener();
	}

	/** Keeps a failure that didn't stop the app, for the operator console's recent errors. */
	private record(where: string, error: unknown) {
		recordError(this.storage, {
			at: Date.now(),
			where,
			message: error instanceof Error ? error.message : String(error),
		});
	}

	private forget() {
		this.me = null;
		this.snapshot = EMPTY;
		this.profiles = new Map();
		this.reads.clear();
		clearCachedSession(this.storage);
		this.notify();
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
			this.publish(me, { snapshots, everyone });
			void this.revealPrivateDetails(me);
			void this.showOlderHistory(me, { snapshots, everyone });
			void this.runDueOrders(me);
			void this.announcements.announceNew(orgIds);
		} catch (error) {
			// A failed poll keeps the last snapshot; the health check handles a dead RPC.
			this.record("testnet refresh", error);
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
			(message) => this.record("standing order", message),
		);
		// Only a run changes what the chain says; after a failure the next poll tries again.
		if (ran) await this.refresh();
	}

	/** What turning chain data into accounts needs besides the data itself. */
	private context() {
		return {
			profiles: this.profiles,
			assets: this.availableAssets,
			potAsset: this.pot?.asset() ?? null,
		};
	}

	/** The workspace built from what was read, shown now and saved for the next visit. */
	private publish(me: string, reading: Reading): void {
		const { people, accounts } = workspaceFromChain(reading, this.context(), (orgId) =>
			this.threads.of(orgId),
		);
		this.raw = accounts;
		this.snapshot = { people, accounts: accounts.map((account) => this.details.reveal(account)) };
		if (this.me?.id === me) {
			// Private notes are cached as stored (encrypted): plain text never reaches local storage.
			saveCachedSession(this.storage, {
				me: this.me,
				workspace: { people, accounts },
				profiles: [...this.profiles.entries()],
			});
		}
	}

	/** Shows the accounts again with whatever this device has opened or read since. */
	private showAgain(): void {
		this.snapshot = {
			...this.snapshot,
			accounts: this.raw.map((account) => this.details.reveal(account)),
		};
		this.notify();
	}

	/** The activity grows once the older ledger history is in (see historyBackfill.ts). */
	private async showOlderHistory(me: string, reading: Reading): Promise<void> {
		const filled = await backfillHistory(this.config, this.history, reading.snapshots);
		if (!filled || this.me?.id !== me) return;
		this.publish(me, { ...reading, snapshots: filled });
		this.notify();
	}

	/** Decrypts the private notes this device can read and shows them. */
	private async revealPrivateDetails(me: string): Promise<void> {
		const revealed = await this.details.open(this.raw, me);
		if (revealed && this.me?.id === me) this.showAgain();
	}

	/** Puts the discussion threads read so far into the workspace on screen. */
	private showThreads(): void {
		this.raw = this.raw.map((account) => ({
			...account,
			discussions: this.threads.of(account.org.id) ?? account.discussions,
		}));
		this.showAgain();
		// Entries of organizations with private details arrive encrypted.
		if (this.me) void this.revealPrivateDetails(this.me.id);
	}

	/** Any organization, read from its contract (an auditor's view; they aren't a member). */
	private async readAccount(orgId: string): Promise<OrgAccount> {
		const snapshot = await readOrganization(this.config, orgId, null);
		return accountFromChain(snapshot, this.context(), {});
	}

	/** A note as it is stored: encrypted when the organization keeps references private. */
	private protectNote(orgId: string, actorId: PersonId, text: string, onChain: boolean) {
		return this.privateKeys
			? this.privateKeys.protect(orgId, actorId, text, onChain)
			: Promise.resolve(ok(text));
	}

	private account(orgId: string): OrgAccount | undefined {
		return this.snapshot.accounts.find((a) => a.org.id === orgId);
	}
}
