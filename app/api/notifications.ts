import { StrKey } from "@stellar/stellar-sdk";
import { isSmartAccount } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { pushPublicKey } from "./_lib/notify.js";
import { isSubscription, removeSubscription, saveSubscription } from "./_lib/pushStore.js";
import { serverConfig } from "./_lib/serverConfig.js";

// Push notifications on a device:
// - GET: the public key browsers need to subscribe (null while notifications aren't set up).
// - POST { action: "subscribe", person, subscription } / { action: "unsubscribe", person, endpoint }.
// Anyone may subscribe a device to an ancora ID: what is sent only repeats public on-chain facts
// (see _lib/notify.ts), so there is nothing to protect beyond keeping strangers' IDs real.

export const config = { maxDuration: 15 };

const publicKey = apiHandler("GET", async () => ({ publicKey: pushPublicKey() }));

const change = apiHandler("POST", async (request) => {
	const body = await readJsonObject(request);
	const person = body.person;
	if (typeof person !== "string" || !StrKey.isValidContract(person)) {
		throw new RequestError("Send your ancora ID (C…).");
	}
	if (body.action === "subscribe") {
		if (!isSubscription(body.subscription)) {
			throw new RequestError("This browser sent a subscription ancora can't use.");
		}
		if (!(await isSmartAccount(serverConfig(), person))) {
			throw new RequestError("Only ancora accounts can receive notifications.", 403);
		}
		await saveSubscription(person, body.subscription);
		return { subscribed: true };
	}
	if (body.action === "unsubscribe") {
		if (typeof body.endpoint !== "string") throw new RequestError("Send the endpoint to remove.");
		await removeSubscription(person, body.endpoint);
		return { subscribed: false };
	}
	throw new RequestError("Unknown action.");
});

export default {
	fetch(request: Request): Promise<Response> {
		return request.method === "GET" ? publicKey.fetch(request) : change.fetch(request);
	},
};
