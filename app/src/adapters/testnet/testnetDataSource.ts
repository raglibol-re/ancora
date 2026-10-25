import type { xdr } from "@stellar/stellar-sdk";
import { StrKey } from "@stellar/stellar-sdk";
import {
	type OrgAccount,
	type Person,
	shortAddress,
	type Workspace,
} from "../../domain/account.ts";
import type {
	ChangeOutcome,
	DataSource,
	FundingSupport,
	Identity,
	IdentitySupport,
	PaymentInput,
	ProfileInput,
} from "../../domain/dataSource.ts";
import type { Cents } from "../../domain/money.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { type PersonId, type RuleError, ruleError } from "../../domain/rules/model.ts";
import { rulesHash } from "../../domain/rules/policyDocument.ts";
import { templates } from "../../domain/rules/templates.ts";
import { recordError } from "../local/recentErrors.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { CONTRACT_ERROR_MESSAGES, mapOrganization } from "./mapOrganization.ts";
import {
	type Profile,
	readOrganization,
	readOrganizationsOf,
	readProfiles,
} from "./organizationContract.ts";
import { describeKitError, passkeyKit } from "./passkeyKit.ts";
import { passkeyUserName } from "./passkeyUserName.ts";
import { checkRecipient } from "./recipientCheck.ts";
import { address, changeToScVal, i128, text, toStroops, u64 } from "./scv.ts";
import { type AssetOption, parseAssetOptions, type TestnetConfig } from "./testnetConfig.ts";

const EMPTY: Workspace = { people: [], accounts: [] };
const MAX_NAME_BYTES = 64;
const MAX_AVATAR_BYTES = 256;
/** A session restore that takes longer than this shows the sign-in page instead of blocking it. */
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
	private readonly config: TestnetConfig;
	private readonly storage: KeyValueStorage | null;
	private readonly listeners = new Set<() => void>();
	private snapshot: Workspace = EMPTY;
	private me: Identity | null = null;
	private restoringSession = true;
	private profiles = new Map<string, Profile | null>();

	constructor(storage: KeyValueStorage | null, config: TestnetConfig) {
		this.storage = storage;
		this.config = config;
		this.availableAssets = parseAssetOptions(config.orgAssets);
		// Stellar Wallets Kit and the wallet SDKs load only when someone funds from a wallet.
		const funding = () => import("./walletFunding.ts");
		this.funding = {
			connectWallet: (container) => funding().then((f) => f.connectWallet(container)),
			disconnectWallet: () => funding().then((f) => f.disconnectWallet()),
			walletBalance: (token, holder) =>
				funding().then((f) => f.walletBalance(config, token, holder)),
			assetName: (token) => funding().then((f) => f.assetName(config, token)),
			depositFromWallet: async (orgId, token, from, amount) => {
				const result = await (await funding()).depositFromWallet(
					config,
					token,
					from,
					orgId,
					amount,
				);
				if (result.ok) await this.refresh();
				return result;
			},
		};
		this.identity = {
			restoring: () => this.restoringSession,
			current: () => this.me,
			createIdentity: (name) => this.createIdentity(name),
			signIn: () => this.signIn(),
			signOut: () => this.signOut(),
			saveProfile: (profile) => this.saveProfile(profile),
			uploadAvatar: (image) => this.uploadAvatar(image),
		};
		void this.restore();
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.snapshot;

	private get kit() {
		return passkeyKit(this.config);
	}

	private notify() {
		for (const listener of this.listeners) listener();
	}

	private async restore() {
		try {
			const session = await Promise.race([
				this.kit.connectWallet(),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), RESTORE_TIMEOUT_MS)),
			]);
			if (session) await this.becomeIdentity(session.contractId);
		} catch {
			// No usable session on this device: the sign-in page takes over.
		} finally {
			this.restoringSession = false;
			this.notify();
		}
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
		try {
			const orgIds = await readOrganizationsOf(this.config, this.config.registryContract, me);
			const snapshots = await Promise.all(orgIds.map((id) => readOrganization(this.config, id)));
			const everyone = new Set<string>([me]);
			for (const snapshot of snapshots) {
				for (const member of snapshot.members) everyone.add(String(member.address));
			}
			this.profiles = await readProfiles(this.config, this.config.registryContract, [...everyone]);
			const orgNames = new Map(snapshots.map((s) => [s.contractId, String(s.info.name)]));
			const symbols = new Map(this.availableAssets.map((a) => [a.token, a.symbol]));
			const accounts: OrgAccount[] = snapshots.map((snapshot) =>
				mapOrganization(
					snapshot,
					(who) => orgNames.get(who) ?? this.profiles.get(who)?.name ?? undefined,
					Date.now(),
					(token, onchainSymbol) => symbols.get(token) ?? onchainSymbol,
				),
			);
			const people: Person[] = [...everyone].map((id) => ({
				id,
				name: this.profiles.get(id)?.name ?? shortAddress(id),
				avatarUrl: this.profiles.get(id)?.avatarUrl ?? null,
			}));
			this.snapshot = { people, accounts };
		} catch (error) {
			// A failed poll keeps the last snapshot; the health check handles a dead RPC.
			recordError(this.storage, {
				at: Date.now(),
				where: "testnet refresh",
				message: error instanceof Error ? error.message : String(error),
			});
		}
		this.notify();
	}

	private async createIdentity(name: string): Promise<Result<Identity, RuleError>> {
		const trimmed = name.trim();
		if (!trimmed || byteLength(trimmed) > MAX_NAME_BYTES) {
			return failed("Enter a name of up to 64 characters.");
		}
		try {
			const wallet = await this.kit.createWallet("ancora", passkeyUserName(trimmed), {
				autoSubmit: true,
			});
			if (wallet.submitResult && !wallet.submitResult.success) {
				return failed(
					`Your account couldn't be created on Stellar: ${wallet.submitResult.error.message}`,
				);
			}
			this.me = { id: wallet.contractId, name: trimmed, avatarUrl: null };
			this.notify();
			const named = await this.invoke(this.config.registryContract, "set_profile", [
				address(wallet.contractId),
				text(trimmed),
				text(""),
			]);
			if (!named.ok) return named;
			await this.becomeIdentity(wallet.contractId);
			return ok({ id: wallet.contractId, name: trimmed, avatarUrl: null });
		} catch (error) {
			return failed(describeKitError(error, "created"));
		}
	}

	private async signIn(): Promise<Result<Identity, RuleError>> {
		try {
			const session = await this.kit.connectWallet({ fresh: true });
			if (!session) return failed("No passkey was chosen.");
			await this.becomeIdentity(session.contractId);
			return this.me ? ok(this.me) : failed("Signing in didn't complete. Try again.");
		} catch (error) {
			return failed(describeKitError(error, "signed in"));
		}
	}

	private async signOut(): Promise<void> {
		await this.kit.disconnect();
		this.me = null;
		this.snapshot = EMPTY;
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
		const response = await fetch("/api/upload-image", {
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
		const result = await this.invoke(orgId, "propose_payment", [
			address(actorId),
			address(input.token),
			address(to),
			i128(toStroops(input.amount)),
			text(input.note.trim()),
		]);
		if (!result.ok) return result;
		const latest = this.account(orgId)?.requests[0];
		return ok(latest?.id ?? "");
	}

	approve(orgId: string, requestId: string, actorId: PersonId) {
		return this.invoke(orgId, "approve", [address(actorId), u64(Number(requestId))]);
	}

	seal(orgId: string, requestId: string, actorId: PersonId) {
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
		const policyHash =
			change.type === "updatePolicy"
				? await rulesHash(
						account.org.templateId,
						account.org.roles,
						change.policy,
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

	async executeRequest(orgId: string, requestId: string) {
		const response = await this.post("/api/execute-request", {
			organization: orgId,
			requestId: Number(requestId),
		});
		if (!response.ok) return response;
		await this.refresh();
		return ok(undefined);
	}

	async addTestMoney(orgId: string, _actorId: PersonId, token: string) {
		const response = await this.post("/api/test-money", { contractId: orgId, token });
		if (!response.ok) return response;
		await this.refresh();
		return ok(undefined);
	}

	private account(orgId: string): OrgAccount | undefined {
		return this.snapshot.accounts.find((a) => a.org.id === orgId);
	}

	/** Calls a contract through the person's account (passkey-signed, fee-sponsored). */
	private async invoke(
		target: string,
		fn: string,
		args: xdr.ScVal[],
	): Promise<Result<void, RuleError>> {
		try {
			const result = await this.kit.executeAndSubmit(target, fn, args);
			if (!result.success) return failed(contractMessage(result.error.message));
		} catch (error) {
			return failed(describeKitError(error, "done"));
		}
		await this.refresh();
		return ok(undefined);
	}

	private async post<T = unknown>(
		path: string,
		body: Record<string, unknown>,
	): Promise<Result<T, RuleError>> {
		const response = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}).catch(() => null);
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

/** Turns the kit's "Error(Contract, #6)" into the organization contract's plain-language text. */
function contractMessage(message: string): string {
	const code = /Error\(Contract, #(\d+)\)/.exec(message)?.[1];
	return (code && CONTRACT_ERROR_MESSAGES[Number(code)]) || `Nothing was changed: ${message}`;
}
