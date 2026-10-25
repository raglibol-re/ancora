import { ConfigError, serverConfig } from "./serverConfig.js";

/** A refusal with an HTTP status; the message is safe to show to the user. */
export class RequestError extends Error {
	readonly status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

function corsHeaders(origin: string | null): Record<string, string> {
	if (!origin) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, X-Client-Name, X-Client-Version",
		Vary: "Origin",
	};
}

export function json(body: unknown, status: number, origin: string | null): Response {
	return Response.json(body, { status, headers: corsHeaders(origin) });
}

/**
 * Shared POST handler shape: origin allowlist for browsers, CORS preflight, and every failure
 * mapped to `{ success: false, error }` (the format the smart-account-kit relayer client reads).
 */
export function postHandler(handle: (request: Request) => Promise<unknown>) {
	return {
		async fetch(request: Request): Promise<Response> {
			const origin = request.headers.get("Origin");
			try {
				if (origin && !serverConfig().allowedOrigins.has(origin)) {
					throw new RequestError("This origin is not allowed.", 403);
				}
				if (request.method === "OPTIONS") {
					return new Response(null, { status: 204, headers: corsHeaders(origin) });
				}
				if (request.method !== "POST") throw new RequestError("Use POST.", 405);
				return json({ success: true, data: await handle(request) }, 200, origin);
			} catch (error) {
				if (error instanceof RequestError) {
					return json({ success: false, error: error.message }, error.status, origin);
				}
				const message =
					error instanceof ConfigError ? error.message : "Something went wrong on the server.";
				console.error(error);
				return json({ success: false, error: message }, 500, origin);
			}
		},
	};
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	let value: unknown;
	try {
		value = await request.json();
	} catch {
		throw new RequestError("The request body must be JSON.");
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new RequestError("The request body must be a JSON object.");
	}
	return value as Record<string, unknown>;
}
