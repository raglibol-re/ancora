import { sql } from "./database.js";

// Push subscriptions per person (their ancora ID), one row per device. A subscription is only
// an address the browser vendor delivers to; what is sent to it is limited to facts that are
// public on-chain anyway (see notify.ts).

export type PushSubscriptionJson = {
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

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
	await sql()`
		insert into push_subscriptions (person, endpoint, p256dh, auth)
		values (${person}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
		on conflict (person, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
}

export async function removeSubscription(person: string, endpoint: string) {
	await sql()`delete from push_subscriptions where person = ${person} and endpoint = ${endpoint}`;
}

/** Every device the person turned notifications on for. */
export async function subscriptionsOf(person: string): Promise<PushSubscriptionJson[]> {
	const rows = await sql()`
		select endpoint, p256dh, auth from push_subscriptions where person = ${person} limit 50`;
	return rows.map((row) => ({
		endpoint: String(row.endpoint),
		keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
	}));
}
