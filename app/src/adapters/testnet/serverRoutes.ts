import { withWork } from "../../domain/pendingWork.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";

/** Routes that only store something off-chain; every other route submits a transaction. */
const OFF_CHAIN_ROUTES = new Set(["/api/discussions", "/api/registry-name"]);

/**
 * Calls one of ancora's own routes. Most of them submit a transaction for the organization
 * (creation, due requests, standing orders, test money, recovery), so the working bar shows
 * "Sending to Stellar"; the off-chain stores (discussions, registry names) only say "Saving".
 */
export async function postToServer<T = unknown>(
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
		return err(
			ruleError(
				"not-allowed",
				payload?.error ?? "ancora's server is unreachable right now. Try again shortly.",
			),
		);
	}
	return ok(payload.data);
}
