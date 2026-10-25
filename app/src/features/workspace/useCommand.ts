import { useCallback, useState } from "react";
import type { Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import { useNotify } from "../notices/NoticeContext.ts";
import { type SignaturePrompt, useConfirmSignature } from "../passkey/PasskeyContext.ts";

type CommandOptions<T> = {
	/** Ask for a signature first; cancelling aborts without an error. */
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
	const [busy, setBusy] = useState(false);

	const run = useCallback(
		async <T>(
			command: () => Promise<Result<T, RuleError>>,
			options: CommandOptions<T> = {},
		): Promise<Result<T, RuleError> | null> => {
			if (options.signature && !(await confirm(options.signature))) return null;
			setBusy(true);
			const result = await command();
			setBusy(false);
			if (!result.ok) {
				notify({ tone: "error", text: result.error.message });
			} else if (options.success) {
				const text =
					typeof options.success === "string" ? options.success : options.success(result.value);
				notify({ tone: "success", text });
			}
			return result;
		},
		[confirm, notify],
	);

	return { run, busy };
}
