import type { xdr } from "@stellar/stellar-sdk";
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
	ProfileInput,
	RampSupport,
	RegistryNameSupport,
	ReleaseSupport,
} from "../../domain/dataSource.ts";
import type { DiscussionEntry } from "../../domain/discussion.ts";
import { withWork } from "../../domain/pendingWork.ts";
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
import { uploadImage } from "./imageUpload.ts";
import { createLifelineSupport } from "./lifelineSupport.ts";
import {
	CONTRACT_ERROR_MESSAGES,
	mapOrganization,
	type OnchainSnapshot,
} from "./mapOrganization.ts";
import { createOrganizationCommands } from "./organizationCommands.ts";
import {
	type Profile,
	readOrganization,
	readOrganizationsOf,
	readProfiles,
} from "./organizationContract.ts";
import { backfillTransfers, merge } from "./orgHistory.ts";
import { passkeyKeys } from "./passkeyKeys.ts";
import { describeKitError, passkeyKit } from "./passkeyKit.ts";
import { passkeyUserName } from "./passkeyUserName.ts";
import { createPotSupport } from "./pot/potSupport.ts";
import { createPrivateKeys, type PrivateKeys } from "./privacySupport.ts";
import { decryptNote } from "./privateCrypto.ts";
import { labelsFor } from "./privateLabels.ts";
import { createRegistryNameSupport, createReleaseSupport } from "./registrySupport.ts";
import { createRequestCommands } from "./requestCommands.ts";
import { SchedulerAnnouncements } from "./schedulerAnnouncements.ts";
import { address, text } from "./scv.ts";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "./sessionCache.ts";
import { type AssetOption, parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";
import { createFundingSupport, createRampSupport } from "./walletSupport.ts";

const EMPTY: Workspace = { people: [], accounts: [] };
const MAX_NAME_BYTES = 64;
const MAX_AVATAR_BYTES = 256;
/** A session restore slower than this stops blocking the screen; a cached pass stays signed in. */
const RESTORE_TIMEOUT_MS = 8_000;

const failed = (message: string) => err(ruleError("not-allowed", message));
const byteLength = (value: string) => new TextEncoder().encode(value).length;

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
	/**
	 * The passkey kit's reconnect started when the page loads. The app shows the cached session
	 * at once, so a signed action can come before the kit is ready; it waits for this instead.
	 */
	private connecting: Promise<unknown> = Promise.resolve();
	/** Organizations this device already announced to the scheduler's index. */
	private readonly announcements: SchedulerAnnouncements;
	/** Discussion threads read so far; screens that show requests ask for them. */
	private readonly threads = new DiscussionThreads();
	/** Due standing orders tried this visit. */
	private readonly orderRuns = new DueOrderRuns();
	/** Short-lived memo of reads several screens ask for at once (Lifeline, passkeys). */
	private readonly memo = new Map<string, { at: number; value: Promise<unknown> }>();

	/** The data source the app uses: the session together with its organizations' commands. */
	static open(storage: KeyValueStorage | null, config: TestnetConfig): DataSource {
		const source = new TestnetDataSource(storage, config);
		const deps: CommandDeps = {
			config,
			availableAssets: source.availableAssets,
			me: () => source.me?.id ?? null,
			account: (orgId) => source.account(orgId),
			invoke: (target, fn, args) => source.invoke(target, fn, args),
			post: (path, body) => source.post(path, body),
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
		const invoke: TestnetDataSource["invoke"] = (target, fn, args, describeContractError) =>
			this.invoke(target, fn, args, describeContractError);
		const refresh = () => this.refresh();
		this.funding = createFundingSupport(config, refresh);
		this.ramps = createRampSupport(config);
		const registry = config.stellarRegistryContract;
		this.registryNames = registry
			? createRegistryNameSupport({
					network: config,
					registry,
					invoke,
					post: (path, body) => this.post(path, body),
					failed,
				})
			: null;
		this.releases = registry ? createReleaseSupport({ network: config, registry, failed }) : null;
		this.lifeline = createLifelineSupport({
			config,
			invoke,
			post: (path, body) => this.post(path, body),
			failed,
			refresh,
			remember: (key, ttlMs, load) => this.remember(key, ttlMs, load),
			forget: (prefix) => {
				for (const key of this.memo.keys()) if (key.startsWith(prefix)) this.memo.delete(key);
			},
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
				passkeyKeys: this.passkeyKeys,
			},
			failed,
			refresh,
		});
		this.fxOracle = config.fxOracle || null;
		this.privateKeys = config.keyringContract
			? createPrivateKeys({
					network: config,
					keyring: config.keyringContract,
					invoke: (target, fn, args) => this.invoke(target, fn, args),
					failed,
					refresh: () => this.refresh(),
					members: (orgId) => this.account(orgId)?.org.members.map((m) => m.personId) ?? [],
					readAccount: (orgId) => this.readAccount(orgId),
					passkeyKeys: this.passkeyKeys,
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
						invoke: (target, fn, args) => this.invoke(target, fn, args),
						failed,
						refresh: () => this.refresh(),
					})
				: null;
		this.continuity = createContinuitySupport({
			network: config,
			verifier: config.sealVerifier,
			invoke: (target, fn, args) => this.invoke(target, fn, args),
			failed,
			refresh: () => this.refresh(),
			passkeyKeys: this.passkeyKeys,
		});
		this.deals = config.dealContract
			? createDealSupport({
					network: config,
					contract: config.dealContract,
					invoke: (target, fn, args) => this.invoke(target, fn, args),
					direct: (orgId, actorId) => {
						const account = this.account(orgId);
						return account?.onchain?.setupPhase === true && account.org.founderId === actorId;
					},
					failed,
					refresh: () => this.refresh(),
				})
			: null;
		this.identity = {
			restoring: () => this.restoringSession,
			syncing: () => this.syncingChain,
			current: () => this.me,
			createIdentity: (name) => this.createIdentity(name),
			signIn: () => this.signIn(),
			signOut: () => this.signOut(),
			saveProfile: (profile) => this.saveProfile(profile),
			uploadAvatar: uploadImage,
			passkeyCount: () => this.passkeyCount(),
			addPasskey: (label) => this.addPasskey(label),
		};
		void this.restore();
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.snapshot;

	/** This pass's device keys derived from its passkey (PRF), or null when it can't. */
	/**
	 * Waits for the kit's reconnect first: without its credential id the browser is asked for any
	 * passkey of the site, which can be the wrong one, or none that answers.
	 */
	private readonly passkeyKeys = async () => {
		await this.ensureConnected();
		return passkeyKeys(this.kit.credentialId);
	};

	private get kit() {
		return passkeyKit(this.config);
	}

	private notify() {
		for (const listener of this.listeners) listener();
	}

	private async restore() {
		const cachedId = this.me?.id ?? null;
		try {
			// The passkey session check and the chain reads don't depend on each other.
			const connection = this.kit.connectWallet();
			this.connecting = connection.catch(() => null);
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
		this.memo.clear();
		clearCachedSession(this.storage);
	}

	/** Reuses an in-flight or recent read for `ttlMs`, so parallel screens cost one request. */
	private remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
		const hit = this.memo.get(key);
		if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
		const value = load();
		this.memo.set(key, { at: Date.now(), value });
		return value;
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
				const result = await this.post("/api/due", {
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

	private async createIdentity(name: string): Promise<Result<Identity, RuleError>> {
		const trimmed = name.trim();
		if (!trimmed || byteLength(trimmed) > MAX_NAME_BYTES) {
			return failed("Enter a name of up to 64 characters.");
		}
		try {
			const wallet = await withWork(
				"Creating your pass on Stellar… confirm with your passkey.",
				() => this.kit.createWallet("ancora", passkeyUserName(trimmed), { autoSubmit: true }),
			);
			if (wallet.submitResult && !wallet.submitResult.success) {
				return failed(
					`Your account couldn't be created on Stellar: ${wallet.submitResult.error.message}`,
				);
			}
			// The sign-in screen stays until the name is on-chain too: showing the app earlier let
			// people leave while the name was still being written, and it was lost.
			const named = await this.invoke(this.config.registryContract, "set_profile", [
				address(wallet.contractId),
				text(trimmed),
				text(""),
			]);
			await this.becomeIdentity(wallet.contractId);
			if (!named.ok) {
				// The account exists either way; the name can be set again on the pass page.
				return failed(
					`Your pass was created, but your name couldn't be saved: ${named.error.message} Add it on your pass page.`,
				);
			}
			return ok(this.me ?? { id: wallet.contractId, name: trimmed, avatarUrl: null });
		} catch (error) {
			return failed(describeKitError(error, "created"));
		}
	}

	private async signIn(): Promise<Result<Identity, RuleError>> {
		try {
			const session = await withWork("Waiting for your passkey…", () =>
				this.kit.connectWallet({ fresh: true }),
			);
			if (!session) return failed("No passkey was chosen.");
			await this.becomeIdentity(session.contractId);
			return this.me ? ok(this.me) : failed("Signing in didn't complete. Try again.");
		} catch (error) {
			return failed(describeKitError(error, "signed in"));
		}
	}

	private async signOut(): Promise<void> {
		await this.kit.disconnect();
		this.forget();
		this.notify();
	}

	private async saveProfile(profile: ProfileInput): Promise<Result<void, RuleError>> {
		const name = profile.name.trim();
		const avatarUrl = profile.avatarUrl?.trim() || null;
		if (!this.me) return failed("Sign in first.");
		if (!name || byteLength(name) > MAX_NAME_BYTES) {
			return failed("Enter a name of up to 64 characters.");
		}
		if (
			avatarUrl &&
			(!avatarUrl.startsWith("https://") || byteLength(avatarUrl) > MAX_AVATAR_BYTES)
		) {
			return failed("The picture link isn't valid. Upload the picture again.");
		}
		const me = this.me.id;
		const result = await this.invoke(this.config.registryContract, "set_profile", [
			address(me),
			text(name),
			text(avatarUrl ?? ""),
		]);
		if (result.ok) {
			this.me = { id: me, name, avatarUrl };
			this.notify();
		}
		return result;
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
		const response = await this.post<{ entries: DiscussionEntry[] }>("/api/discussions", body);
		if (!response.ok) return response;
		this.threads.set(body.org, response.value.entries);
		this.showThreads();
		return ok(undefined);
	}

	private account(orgId: string): OrgAccount | undefined {
		return this.snapshot.accounts.find((a) => a.org.id === orgId);
	}

	/** The kit creates one everyday rule per account; its External signers are the passkeys. */
	private async everydayRule() {
		const rules = await this.kit.rules.list();
		const rule = rules[0];
		if (!rule) throw new Error("Your account has no signing rule.");
		return rule;
	}

	private passkeyCount(): Promise<Result<number, RuleError>> {
		return this.remember("passkeys", 60_000, async () => {
			try {
				const rule = await this.everydayRule();
				return ok(rule.signers.filter((signer) => signer.tag === "External").length);
			} catch (error) {
				return failed(describeKitError(error, "read"));
			}
		});
	}

	private async addPasskey(label: string): Promise<Result<void, RuleError>> {
		try {
			const rule = await this.everydayRule();
			const { transaction } = await this.kit.signers.addPasskey(
				rule.id,
				"ancora",
				passkeyUserName(label),
				{ nickname: label },
			);
			if (!(await this.ensureConnected())) return failed(SESSION_ENDED);
			const result = await withWork(SIGNING, () => this.kit.signAndSubmitAdmin(transaction));
			if (!result.success) return failed(describeKitError(result.error, "added"));
			this.memo.delete("passkeys");
			return ok(undefined);
		} catch (error) {
			return failed(describeKitError(error, "added"));
		}
	}

	/** Calls a contract through the person's account (passkey-signed, fee-sponsored). */
	private async invoke(
		target: string,
		fn: string,
		args: xdr.ScVal[],
		describeContractError: (message: string) => string = contractMessage,
	): Promise<Result<void, RuleError>> {
		if (!(await this.ensureConnected())) return failed(SESSION_ENDED);
		try {
			const result = await withWork(SIGNING, () => this.kit.executeAndSubmit(target, fn, args));
			if (!result.success) return failed(describeContractError(result.error.message));
		} catch (error) {
			return failed(describeKitError(error, "done"));
		}
		await this.refresh();
		return ok(undefined);
	}

	/** Waits for the kit's reconnect after a page load; tries once more if it didn't connect. */
	private async ensureConnected(): Promise<boolean> {
		if (this.kit.isConnected) return true;
		await withWork("Reconnecting your passkey…", async () => {
			await this.connecting;
			if (!this.kit.isConnected) await this.kit.connectWallet().catch(() => null);
		});
		return this.kit.isConnected;
	}

	/**
	 * Calls one of ancora's own routes. Most of them submit a transaction for the organization
	 * (creation, due requests, standing orders, test money, recovery), so the working bar shows
	 * "Sending to Stellar"; the off-chain stores (discussions, registry names) only say "Saving".
	 */
	private async post<T = unknown>(
		path: string,
		body: Record<string, unknown>,
	): Promise<Result<T, RuleError>> {
		const label = OFF_CHAIN_ROUTES.has(path) ? "Saving…" : "Sending to Stellar…";
		const response = await withWork(label, () =>
			fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}).catch(() => null),
		);
		const payload = (await response?.json().catch(() => null)) as {
			success?: boolean;
			data?: T;
			error?: string;
		} | null;
		if (!payload?.success || payload.data === undefined) {
			return failed(
				payload?.error ?? "ancora's server is unreachable right now. Try again shortly.",
			);
		}
		return ok(payload.data);
	}
}

const SESSION_ENDED =
	"Your passkey session on this device has ended, so nothing was done. Sign out and sign in again with your passkey.";

/** Shown on the working bar while the passkey signs and the transaction travels to Stellar. */
const SIGNING = "Sending to Stellar… confirm with your passkey if asked.";
const OFF_CHAIN_ROUTES = new Set(["/api/discussions", "/api/registry-name"]);

/** Turns the kit's "Error(Contract, #6)" into the organization contract's plain-language text. */
function contractMessage(message: string): string {
	const code = /Error\(Contract, #(\d+)\)/.exec(message)?.[1];
	return (code && CONTRACT_ERROR_MESSAGES[Number(code)]) || `Nothing was changed: ${message}`;
}
