import { useCallback, useState } from "react";
import { recordError } from "../../adapters/local/recentErrors.ts";
import type { Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { useNotify } from "../notices/NoticeContext.ts";
import { type SignaturePrompt, useConfirmSignature } from "../passkey/PasskeyContext.ts";
import { beginCommand } from "./pendingCommands.ts";
import { browserStorage } from "./preferences.ts";
import { useWorkspace } from "./WorkspaceContext.ts";

type CommandOptions<T> = {
	/**
	 * Ask for a signature first; cancelling aborts without an error. Shown as the simulated prompt
	 * for sample data and for the security seal (task 8); on testnet the device's real passkey
	 * prompt comes from the data source instead.
	 */
	signature?: SignaturePrompt;
	success?: string | ((value: T) => string);
};

/**
 * Runs a data-source command with the shared UX: optional signature prompt, busy state,
 * success notice, and the engine's plain-language error on failure.
 */
export function useCommand() {
	const confirm = useConfirmSignature();
	const notify = useNotify();
	const { dataSource } = useWorkspace();
	const [busy, setBusy] = useState(false);

	const run = useCallback(
		async <T>(
			command: () => Promise<Result<T, RuleError>>,
			options: CommandOptions<T> = {},
		): Promise<Result<T, RuleError> | null> => {
			const simulated =
				options.signature && (dataSource.kind === "sample" || options.signature.kind === "seal");
			if (simulated && options.signature && !(await confirm(options.signature))) return null;
			setBusy(true);
			// The shell shows a working bar meanwhile: a passkey prompt and a Stellar transaction
			// take a few seconds, and silence would read as nothing happening.
			const done = beginCommand(
				dataSource.kind === "sample"
					? "Working…"
					: "Sending to Stellar… confirm with your passkey if asked.",
			);
			let result: Result<T, RuleError>;
			try {
				result = await command();
			} finally {
				done();
				setBusy(false);
			}
			if (!result.ok) {
				notify({ tone: "error", text: result.error.message });
				recordError(browserStorage(), {
					at: Date.now(),
					where: window.location.pathname,
					message: result.error.message,
				});
			} else if (options.success) {
				const text =
					typeof options.success === "string" ? options.success : options.success(result.value);
				notify({ tone: "success", text });
			}
			return result;
		},
		[confirm, notify, dataSource],
	);

	return { run, busy };
}
