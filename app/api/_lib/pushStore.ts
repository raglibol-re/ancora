import { createHash } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

// Push subscriptions per person (their ancora ID), one file per device in ancora's Blob store.
// A subscription is only an address the browser vendor delivers to; what is sent to it is
// limited to facts that are public on-chain anyway (see notify.ts).

export type PushSubscriptionJson = {
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

const ROOT = "push";

function pathOf(person: string, endpoint: string): string {
	const id = createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
	return `${ROOT}/${person}/${id}.json`;
}

export function isSubscription(value: unknown): value is PushSubscriptionJson {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
	return (
		typeof candidate.endpoint === "string" &&
		candidate.endpoint.startsWith("https://") &&
		candidate.endpoint.length < 1_000 &&
		typeof candidate.keys?.p256dh === "string" &&
		typeof candidate.keys?.auth === "string"
	);
}

export async function saveSubscription(person: string, subscription: PushSubscriptionJson) {
	const { endpoint, keys } = subscription;
	await put(pathOf(person, endpoint), JSON.stringify({ endpoint, keys }), {
		access: "public",
		addRandomSuffix: false,
		allowOverwrite: true,
		contentType: "application/json",
		cacheControlMaxAge: 0,
	});
}

export async function removeSubscription(person: string, endpoint: string) {
	await del(pathOf(person, endpoint)).catch(() => undefined);
}

/** Every device the person turned notifications on for. */
export async function subscriptionsOf(person: string): Promise<PushSubscriptionJson[]> {
	const { blobs } = await list({ prefix: `${ROOT}/${person}/`, limit: 50 });
	const found = await Promise.all(
		blobs.map(async (blob) => {
			const result = await get(blob.pathname, { access: "public", useCache: false });
			if (result?.statusCode !== 200) return null;
			const parsed: unknown = JSON.parse(await new Response(result.stream).text());
			return isSubscription(parsed) ? parsed : null;
		}),
	);
	return found.filter((s): s is PushSubscriptionJson => s !== null);
}
