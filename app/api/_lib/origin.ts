/**
 * Browser requests from the site itself are always accepted, whichever of the project's hosts
 * served it (canonical domain, branch or deployment URLs). Cross-origin requests are accepted
 * only from the allowlist (local development). Requests without an Origin header (curl, server
 * to server) pass here and are judged by their content.
 */
export function originAllowed(
	origin: string | null,
	host: string | null,
	allowlist: ReadonlySet<string>,
): boolean {
	if (!origin) return true;
	if (allowlist.has(origin)) return true;
	try {
		return host !== null && new URL(origin).host === host;
	} catch {
		return false;
	}
}
