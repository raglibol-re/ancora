import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";

// Push notifications on this device: the browser's permission, its push subscription, and
// telling ancora's server which ancora ID the device belongs to.

export type PushState = "unsupported" | "blocked" | "off" | "on";

const failed = (message: string): Result<never, RuleError> =>
	err(ruleError("not-allowed", message));

export function pushSupported(): boolean {
	return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushState(): Promise<PushState> {
	if (!pushSupported()) return "unsupported";
	if (Notification.permission === "denied") return "blocked";
	const registration = await navigator.serviceWorker.getRegistration();
	const subscription = await registration?.pushManager.getSubscription();
	return subscription && Notification.permission === "granted" ? "on" : "off";
}

/** The VAPID key arrives as base64url; the browser wants raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const base64 = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const raw = atob(base64);
	const bytes = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

async function post(body: Record<string, unknown>): Promise<Result<void, RuleError>> {
	const response = await fetch("/api/notifications", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	}).catch(() => null);
	const payload = (await response?.json().catch(() => null)) as {
		success?: boolean;
		error?: string;
	} | null;
	return payload?.success
		? ok(undefined)
		: failed(payload?.error ?? "ancora's server is unreachable right now. Try again shortly.");
}

export async function enablePush(person: string): Promise<Result<void, RuleError>> {
	if (!pushSupported()) {
		return failed(
			"This browser can't receive notifications. On an iPhone, add ancora to the home screen first.",
		);
	}
	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		return failed(
			"Notifications are blocked for ancora. Allow them in the browser's site settings.",
		);
	}
	const keyResponse = await fetch("/api/notifications").catch(() => null);
	const key = (
		(await keyResponse?.json().catch(() => null)) as {
			data?: { publicKey?: string | null };
		} | null
	)?.data?.publicKey;
	if (!key) return failed("Notifications aren't set up on ancora's server yet.");
	const registration = await navigator.serviceWorker.ready;
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(key),
		}));
	return post({ action: "subscribe", person, subscription: subscription.toJSON() });
}

export async function disablePush(person: string): Promise<Result<void, RuleError>> {
	const registration = await navigator.serviceWorker.getRegistration();
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return ok(undefined);
	const removed = await post({ action: "unsubscribe", person, endpoint: subscription.endpoint });
	await subscription.unsubscribe();
	return removed;
}
