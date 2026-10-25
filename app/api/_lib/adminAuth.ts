import { createHash, timingSafeEqual } from "node:crypto";
import { RequestError } from "./http.js";

export const ADMIN_HEADER = "X-Ancora-Admin";

/** Constant-time passphrase comparison over digests, so neither length nor content leaks. */
export function passphraseMatches(given: string | null, expected: string): boolean {
	if (!given) return false;
	const a = createHash("sha256").update(given).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

/** Throws unless the request carries the operator passphrase from ADMIN_PASSPHRASE. */
export function requireAdmin(request: Request, expected: string | undefined): void {
	if (!expected) {
		throw new RequestError("The demo admin is not set up: ADMIN_PASSPHRASE is missing.", 503);
	}
	if (!passphraseMatches(request.headers.get(ADMIN_HEADER), expected)) {
		throw new RequestError("Wrong passphrase.", 401);
	}
}
