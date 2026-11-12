import type { xdr } from "@stellar/stellar-sdk";
import { StrKey } from "@stellar/stellar-sdk";
import {
	type OrgAccount,
	type Person,
	shortAddress,
	type Workspace,
} from "../../domain/account.ts";
import type {
	BatchInput,
	ChangeOutcome,
	ContinuitySupport,
	DataSource,
	DealSupport,
	DeviceKeySupport,
	DiscussionSupport,
	EscrowView,
	FundingSupport,
	Identity,
	IdentitySupport,
	LifelineSupport,
	PaymentInput,
	PotSupport,
	PrivacySupport,
	ProfileInput,
	RampSupport,
	RegistryNameSupport,
	ReleaseSupport,
	StandingOrderInput,
} from "../../domain/dataSource.ts";
import type { DiscussionEntry } from "../../domain/discussion.ts";
import type { Cents } from "../../domain/money.ts";
import { withWork } from "../../domain/pendingWork.ts";
import {
	type PayeeLabel,
	PRIVATE_PAYEE_NAME,
	privateNotesOf,
	revealNotes,
	revealPayees,
} from "../../domain/privateNote.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import { rulesHash } from "../../domain/rules/policyDocument.ts";
import { templates } from "../../domain/rules/templates.ts";
import { recordError } from "../local/recentErrors.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { createContinuitySupport, sealWithDeviceKey } from "./continuitySupport.ts";
import { createdId } from "./createdItem.ts";
import { createDealSupport } from "./dealSupport.ts";
import { createDeviceKeySupport } from "./deviceKeySupport.ts";
import { DiscussionThreads } from "./discussionThreads.ts";
import { DueOrderRuns } from "./dueOrderRuns.ts";
import { type HistoryCache, historyCache } from "./historyCache.ts";
import { createLifelineSupport } from "./lifelineSupport.ts";
import {
	CONTRACT_ERROR_MESSAGES,
	mapAsset,
	mapOrganization,
	mapRequest,
	type OnchainSnapshot,
} from "./mapOrganization.ts";
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
import { readContract } from "./readContract.ts";
import { checkRecipient } from "./recipientCheck.ts";
import { createRegistryNameSupport, createReleaseSupport } from "./registrySupport.ts";
import { SchedulerAnnouncements } from "./schedulerAnnouncements.ts";
import {
	address,
	batchLinesToScVal,
	bool,
	changeToScVal,
	i128,
	optionalSymbol,
	text,
	toStroops,
	u32,
	u64,
} from "./scv.ts";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "./sessionCache.ts";
import { type AssetOption, parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";
import { inspectToken } from "./tokenInspect.ts";
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
 */
export class TestnetDataSource implements DataSource {
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

	constructor(storage: KeyValueStorage | null, config: TestnetConfig) {
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
			uploadAvatar: (image) => this.uploadAvatar(image),
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

	private async uploadAvatar(image: Blob): Promise<Result<string, RuleError>> {
		const response = await fetch("/api/image", {
			method: "POST",
			headers: { "Content-Type": image.type },
			body: image,
		}).catch(() => null);
		const payload = (await response?.json().catch(() => null)) as {
			success?: boolean;
			data?: { url?: string };
			error?: string;
		} | null;
		if (!payload?.success || typeof payload.data?.url !== "string") {
			return failed(
				payload?.error ?? "The picture couldn't be stored right now. Try again shortly.",
			);
		}
		return ok(payload.data.url);
	}

	async createOrganization(input: Parameters<DataSource["createOrganization"]>[0]) {
		if (!this.me) return failed("Sign in first.");
		const template = templates[input.templateId];
		const policyHash = await rulesHash(
			template.id,
			template.roles,
			template.policy,
			input.baseCurrency,
		);
		const response = await this.post<{ contractId: string }>("/api/create-organization", {
			founder: this.me.id,
			founderRole: input.founderRoleId,
			template: input.templateId,
			name: input.name.trim(),
			policyHash,
			baseCurrency: input.baseCurrency,
			assets: input.assets,
		});
		if (!response.ok) return response;
		await this.refresh();
		return ok(response.value.contractId);
	}

	async requestPayment(orgId: string, actorId: PersonId, input: PaymentInput) {
		const to = "id" in input.payee ? input.payee.id : input.payee.account.trim();
		if (!StrKey.isValidEd25519PublicKey(to) && !StrKey.isValidContract(to)) {
			return failed("Enter the recipient's Stellar address (starts with G or C).");
		}
		const recipient = await checkRecipient(this.config, input.token, to).catch((error: unknown) => {
			// The check is a courtesy; if the RPC hiccups the contract still decides.
			recordError(this.storage, {
				at: Date.now(),
				where: "recipient check",
				message: error instanceof Error ? error.message : String(error),
			});
			return null;
		});
		if (recipient && !recipient.ok) return recipient;
		const note = await this.protectNote(orgId, actorId, input.note.trim(), true);
		if (!note.ok) return note;
		const before = this.requestIds(orgId);
		const result = await this.invoke(orgId, "propose_payment", [
			address(actorId),
			address(input.token),
			address(to),
			i128(toStroops(input.amount)),
			text(note.value),
			optionalSymbol(input.category ?? null),
			bool(input.escrow ?? false),
		]);
		if (!result.ok) return result;
		return ok(await this.created(() => this.requestIds(orgId), before));
	}

	async requestBatch(orgId: string, actorId: PersonId, input: BatchInput) {
		const lines = input.lines.map((line) => ({
			to: ("id" in line.payee ? line.payee.id : line.payee.account).trim(),
			amount: line.amount,
			note: line.note.trim(),
		}));
		const bad = lines.find(
			(line) => !StrKey.isValidContract(line.to) && !StrKey.isValidEd25519PublicKey(line.to),
		);
		if (bad) return failed(`"${bad.to || "(empty)"}" isn't a Stellar address (G… or C…).`);
		// Every recipient must be able to take the asset, or the whole batch fails at payout.
		const checks = await Promise.all(
			[...new Set(lines.map((line) => line.to))].map((to) =>
				checkRecipient(this.config, input.token, to).catch(() => null),
			),
		);
		const refused = checks.find((check) => check && !check.ok);
		if (refused && !refused.ok) return refused;
		const notes = await Promise.all(
			[input.note.trim(), ...lines.map((line) => line.note)].map((note) =>
				this.protectNote(orgId, actorId, note, true),
			),
		);
		const failedNote = notes.find((note) => !note.ok);
		if (failedNote && !failedNote.ok) return failedNote;
		const stored = notes.map((note) => (note.ok ? note.value : ""));
		const before = this.requestIds(orgId);
		const result = await this.invoke(orgId, "propose_batch", [
			address(actorId),
			address(input.token),
			batchLinesToScVal(lines.map((line, index) => ({ ...line, note: stored[index + 1] ?? "" }))),
			text(stored[0] ?? ""),
			optionalSymbol(input.category ?? null),
		]);
		if (!result.ok) return result;
		return ok(await this.created(() => this.requestIds(orgId), before));
	}

	approve(orgId: string, requestId: string, actorId: PersonId) {
		return this.invoke(orgId, "approve", [address(actorId), u64(Number(requestId))]);
	}

	seal(orgId: string, requestId: string, actorId: PersonId) {
		// Organizations that named an ML-DSA verifier take seals signed by the device key only.
		if (this.account(orgId)?.org.sealVerifier) {
			const invoke = (target: string, fn: string, args: xdr.ScVal[]) =>
				this.invoke(target, fn, args);
			return sealWithDeviceKey(
				{ network: this.config, invoke, failed },
				orgId,
				Number(requestId),
				actorId,
			);
		}
		return this.invoke(orgId, "seal", [address(actorId), u64(Number(requestId))]);
	}

	decline(orgId: string, requestId: string, actorId: PersonId) {
		return this.invoke(orgId, "decline", [address(actorId), u64(Number(requestId))]);
	}

	async proposeChange(
		orgId: string,
		actorId: PersonId,
		change: GovernanceChange,
	): Promise<Result<ChangeOutcome, RuleError>> {
		const account = this.account(orgId);
		if (!account) return failed("This organization doesn't exist anymore. Reload the page.");
		if (change.type === "addMember" && !StrKey.isValidContract(change.personId.trim())) {
			return failed("Enter the person's ancora ID (their account address, starts with C).");
		}
		// Rule and role changes carry the fingerprint of the rules document they leave behind.
		const policyHash =
			change.type === "updatePolicy"
				? await rulesHash(
						account.org.templateId,
						account.org.roles,
						change.policy,
						account.org.baseCurrency,
					)
				: change.type === "setRoles"
					? await rulesHash(
							account.org.templateId,
							change.roles,
							account.org.policy,
							account.org.baseCurrency,
						)
					: undefined;
		const encoded = changeToScVal(
			change.type === "addMember" ? { ...change, personId: change.personId.trim() } : change,
			policyHash,
		);
		if (!encoded) return failed("Switching templates isn't available on Stellar yet.");
		const direct = account.onchain?.setupPhase && account.org.founderId === actorId;
		const result = await this.invoke(orgId, direct ? "change_directly" : "propose_change", [
			address(actorId),
			encoded,
		]);
		return result.ok ? ok(direct ? "applied" : "requested") : result;
	}

	moveToReserve(orgId: string, actorId: PersonId, token: string, amount: Cents) {
		return this.invoke(orgId, "move_to_reserve", [
			address(actorId),
			address(token),
			i128(toStroops(amount)),
		]);
	}

	withdrawFromReserve(orgId: string, actorId: PersonId, token: string, amount: Cents) {
		return this.invoke(orgId, "withdraw_from_reserve", [
			address(actorId),
			address(token),
			i128(toStroops(amount)),
		]);
	}

	/** Stores the image in ancora's image store, then writes its URL on the organization. */
	async setLogo(orgId: string, actorId: PersonId, logoDataUrl: string) {
		const image = await fetch(logoDataUrl).then((r) => r.blob());
		const uploaded = await this.uploadAvatar(image);
		if (!uploaded.ok) return uploaded;
		return this.invoke(orgId, "set_logo", [address(actorId), text(uploaded.value)]);
	}

	confirmEscrow(orgId: string, requestId: string, actorId: PersonId) {
		return this.invoke(orgId, "confirm_escrow", [address(actorId), u64(Number(requestId))]);
	}

	cancelEscrow(orgId: string, requestId: string, actorId: PersonId) {
		return this.invoke(orgId, "cancel_escrow", [address(actorId), u64(Number(requestId))]);
	}

	/** Reads one organization's request directly, so a recipient needs no membership. */
	async escrowOf(orgId: string, requestId: string): Promise<Result<EscrowView, RuleError>> {
		try {
			const id = u64(Number(requestId));
			const [info, native, assets, state] = await Promise.all([
				readContract(this.config, orgId, "info") as Promise<Record<string, unknown>>,
				readContract(this.config, orgId, "request", [id]) as Promise<Record<string, unknown>>,
				readContract(this.config, orgId, "assets") as Promise<Record<string, unknown>[]>,
				readContract(this.config, orgId, "escrow", [id]) as Promise<Record<string, unknown>>,
			]);
			const symbols = new Map(this.availableAssets.map((a) => [a.token, a.symbol]));
			const mapped = assets.map((a) =>
				mapAsset(a, (token, onchain) => symbols.get(token) ?? onchain),
			);
			const request = mapRequest(native, Date.now(), mapped, state);
			if (request.kind !== "payment" || !request.escrow) {
				return failed("This request isn't a held handover. Check the link.");
			}
			return ok({ orgName: String(info.name), currency: request.currency, request });
		} catch (error) {
			return failed(
				error instanceof Error
					? `This handover couldn't be read. ${error.message}`
					: "This handover couldn't be read.",
			);
		}
	}

	async executeRequest(orgId: string, requestId: string) {
		const response = await this.post("/api/due", {
			organization: orgId,
			requestId: Number(requestId),
		});
		if (!response.ok) return response;
		await this.refresh();
		return ok(undefined);
	}

	async setStandingOrder(orgId: string, actorId: PersonId, input: StandingOrderInput) {
		const note = await this.protectNote(orgId, actorId, input.note.trim(), true);
		if (!note.ok) return note;
		const result = await this.invoke(orgId, "set_standing_order", [
			address(actorId),
			address(input.token),
			address(input.to.trim()),
			i128(toStroops(input.amount)),
			text(note.value),
			optionalSymbol(input.category ?? null),
			u64(input.intervalSeconds),
			u64(Math.floor(input.firstAt / 1000)),
		]);
		return result.ok ? ok(undefined) : result;
	}

	async savePayee(
		orgId: string,
		actorId: PersonId,
		payee: { account: string; name: string; note: string },
	) {
		const to = payee.account.trim();
		if (!StrKey.isValidContract(to) && !StrKey.isValidEd25519PublicKey(to)) {
			return failed("Enter a Stellar address (starts with G or C).");
		}
		const label = { name: payee.name.trim(), note: payee.note.trim() };
		const stored = this.privateKeys
			? await this.privateKeys.protectLabel(orgId, actorId, to, label)
			: ok(label);
		if (!stored.ok) return stored;
		return this.invoke(orgId, "set_payee", [
			address(actorId),
			address(to),
			text(stored.value.name),
			text(stored.value.note),
		]);
	}

	removePayee(orgId: string, actorId: PersonId, account: string) {
		return this.invoke(orgId, "remove_payee", [address(actorId), address(account)]);
	}

	async createLink(
		orgId: string,
		actorId: PersonId,
		input: { token: string; amount: Cents; note: string; maxPayments: number },
	) {
		const linkIds = () => (this.account(orgId)?.paymentLinks ?? []).map((link) => link.id);
		const before = linkIds();
		const result = await this.invoke(orgId, "create_link", [
			address(actorId),
			address(input.token),
			i128(toStroops(input.amount)),
			text(input.note.trim()),
			u32(input.maxPayments),
		]);
		if (!result.ok) return result;
		return ok(await this.created(linkIds, before));
	}

	closeLink(orgId: string, actorId: PersonId, linkId: string) {
		return this.invoke(orgId, "close_link", [address(actorId), u64(Number(linkId))]);
	}

	cancelStandingOrder(orgId: string, actorId: PersonId, orderId: string) {
		return this.invoke(orgId, "cancel_standing_order", [address(actorId), u64(Number(orderId))]);
	}

	async runStandingOrder(orgId: string, orderId: string) {
		const response = await this.post("/api/due", {
			organization: orgId,
			orderId: Number(orderId),
		});
		if (!response.ok) return response;
		await this.refresh();
		return ok(undefined);
	}

	canReceive(token: string, recipient: string) {
		return checkRecipient(this.config, token, recipient.trim());
	}

	inspectToken(reference: string) {
		return inspectToken(this.config, reference);
	}

	async addTestMoney(orgId: string, _actorId: PersonId, token: string) {
		const response = await this.post("/api/test-money", { contractId: orgId, token });
		if (!response.ok) return response;
		await this.refresh();
		return ok(undefined);
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

	private requestIds(orgId: string): string[] {
		return (this.account(orgId)?.requests ?? []).map((request) => request.id);
	}

	/** The id of what a command just created; "" when the chain doesn't show it yet. */
	private created(ids: () => readonly string[], before: readonly string[]): Promise<string> {
		return createdId(ids, before, () => this.refresh());
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
