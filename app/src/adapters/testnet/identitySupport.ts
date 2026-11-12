import type { Identity, IdentitySupport } from "../../domain/dataSource.ts";
import { withWork } from "../../domain/pendingWork.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { uploadImage } from "./imageUpload.ts";
import { describeKitError } from "./passkeyKit.ts";
import { type PasskeySession, SESSION_ENDED, SIGNING } from "./passkeySession.ts";
import { passkeyUserName } from "./passkeyUserName.ts";
import { address, text } from "./scv.ts";
import type { SharedReads } from "./sharedReads.ts";

// A person's pass: created with a passkey, signed in and out, its name and picture in the
// registry, and the passkeys that may sign for it.

const MAX_NAME_BYTES = 64;
const MAX_AVATAR_BYTES = 256;
const PASSKEYS_KEY = "passkeys";
const PASSKEYS_KEEP_MS = 60_000;

const byteLength = (value: string) => new TextEncoder().encode(value).length;

type Deps = {
	/** ancora's registry, which keeps every pass's name and picture. */
	registry: string;
	session: PasskeySession;
	reads: SharedReads;
	restoring: () => boolean;
	syncing: () => boolean;
	current: () => Identity | null;
	/** Makes this account the signed-in person and reads their organizations. */
	become: (id: string) => Promise<void>;
	/** Shows the name and picture that were just written to the registry. */
	show: (identity: Identity) => void;
	/** Forgets the pass on this device. */
	leave: () => void;
	failed: (message: string) => Result<never, RuleError>;
};

export function createIdentitySupport(deps: Deps): IdentitySupport {
	const { session, failed } = deps;

	const setProfile = (id: string, name: string, avatarUrl: string) =>
		session.invoke(deps.registry, "set_profile", [address(id), text(name), text(avatarUrl)]);

	/** The kit creates one everyday rule per account; its External signers are the passkeys. */
	const everydayRule = async () => {
		const rule = (await session.kit.rules.list())[0];
		if (!rule) throw new Error("Your account has no signing rule.");
		return rule;
	};

	return {
		restoring: deps.restoring,
		syncing: deps.syncing,
		current: deps.current,
		uploadAvatar: uploadImage,

		createIdentity: async (name) => {
			const trimmed = name.trim();
			if (!trimmed || byteLength(trimmed) > MAX_NAME_BYTES) {
				return failed("Enter a name of up to 64 characters.");
			}
			try {
				const wallet = await withWork(
					"Creating your pass on Stellar… confirm with your passkey.",
					() => session.kit.createWallet("ancora", passkeyUserName(trimmed), { autoSubmit: true }),
				);
				if (wallet.submitResult && !wallet.submitResult.success) {
					return failed(
						`Your account couldn't be created on Stellar: ${wallet.submitResult.error.message}`,
					);
				}
				// The sign-in screen stays until the name is on-chain too: showing the app earlier let
				// people leave while the name was still being written, and it was lost.
				const named = await setProfile(wallet.contractId, trimmed, "");
				await deps.become(wallet.contractId);
				if (!named.ok) {
					// The account exists either way; the name can be set again on the pass page.
					return failed(
						`Your pass was created, but your name couldn't be saved: ${named.error.message} Add it on your pass page.`,
					);
				}
				return ok(deps.current() ?? { id: wallet.contractId, name: trimmed, avatarUrl: null });
			} catch (error) {
				return failed(describeKitError(error, "created"));
			}
		},

		signIn: async () => {
			try {
				const connected = await withWork("Waiting for your passkey…", () =>
					session.kit.connectWallet({ fresh: true }),
				);
				if (!connected) return failed("No passkey was chosen.");
				await deps.become(connected.contractId);
				const me = deps.current();
				return me ? ok(me) : failed("Signing in didn't complete. Try again.");
			} catch (error) {
				return failed(describeKitError(error, "signed in"));
			}
		},

		signOut: async () => {
			await session.kit.disconnect();
			deps.leave();
		},

		saveProfile: async (profile) => {
			const name = profile.name.trim();
			const avatarUrl = profile.avatarUrl?.trim() || null;
			const me = deps.current()?.id;
			if (!me) return failed("Sign in first.");
			if (!name || byteLength(name) > MAX_NAME_BYTES) {
				return failed("Enter a name of up to 64 characters.");
			}
			if (
				avatarUrl &&
				(!avatarUrl.startsWith("https://") || byteLength(avatarUrl) > MAX_AVATAR_BYTES)
			) {
				return failed("The picture link isn't valid. Upload the picture again.");
			}
			const result = await setProfile(me, name, avatarUrl ?? "");
			if (result.ok) deps.show({ id: me, name, avatarUrl });
			return result;
		},

		passkeyCount: () =>
			deps.reads.remember(PASSKEYS_KEY, PASSKEYS_KEEP_MS, async () => {
				try {
					const rule = await everydayRule();
					return ok(rule.signers.filter((signer) => signer.tag === "External").length);
				} catch (error) {
					return failed(describeKitError(error, "read"));
				}
			}),

		addPasskey: async (label) => {
			try {
				const rule = await everydayRule();
				const { transaction } = await session.kit.signers.addPasskey(
					rule.id,
					"ancora",
					passkeyUserName(label),
					{ nickname: label },
				);
				if (!(await session.ensureConnected())) return failed(SESSION_ENDED);
				const result = await withWork(SIGNING, () => session.kit.signAndSubmitAdmin(transaction));
				if (!result.success) return failed(describeKitError(result.error, "added"));
				deps.reads.forget(PASSKEYS_KEY);
				return ok(undefined);
			} catch (error) {
				return failed(describeKitError(error, "added"));
			}
		},
	};
}
