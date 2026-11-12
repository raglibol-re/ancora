import type { DeviceKeySupport } from "../../domain/dataSource.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { exportDeviceKeys, importDeviceKeys } from "./deviceKeys.ts";
import { describeKitError } from "./passkeyKit.ts";
import { restoreWithPasskey } from "./passkeyRestore.ts";

// The keys a pass keeps on this device (private details, seals): a backup code to carry them to
// another device, and bringing them back from the code or from the passkey itself.

type Deps = {
	/** What restoring from the passkey needs to find and check the person's keys. */
	restore: Parameters<typeof restoreWithPasskey>[0];
	failed: (message: string) => Result<never, RuleError>;
	refresh: () => Promise<void>;
};

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createDeviceKeySupport(deps: Deps): DeviceKeySupport {
	return {
		backupCode: async (personId) => {
			try {
				return ok(await exportDeviceKeys(personId));
			} catch (error) {
				return deps.failed(`Couldn't read the keys on this device: ${describe(error)}`);
			}
		},
		restore: async (personId, code) => {
			try {
				const restored = await importDeviceKeys(personId, code);
				await deps.refresh();
				return ok(restored);
			} catch (error) {
				return deps.failed(describe(error));
			}
		},
		restoreWithPasskey: async (personId) => {
			try {
				const restored = await restoreWithPasskey(deps.restore, personId);
				await deps.refresh();
				return ok(restored);
			} catch (error) {
				return deps.failed(describeKitError(error, "restored"));
			}
		},
	};
}
