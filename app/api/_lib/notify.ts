import { Address, nativeToScVal, scValToNative, type xdr } from "@stellar/stellar-sdk";
import webpush from "web-push";
import { readView } from "./contracts.js";
import { removeSubscription, subscriptionsOf } from "./pushStore.js";
import type { ServerConfig } from "./serverConfig.js";

// Who should hear about an action the relayer just submitted, and what. Messages only repeat
// what is public on the ledger anyway (organizations, amounts, statuses), so a subscription
// can't leak anything private. Sending is best effort: a failure never affects the action.

export type Notice = { title: string; body: string; url: string; tag: string };

function vapid(): { publicKey: string; privateKey: string } | null {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	return publicKey && privateKey ? { publicKey, privateKey } : null;
}

export function pushPublicKey(): string | null {
	return vapid()?.publicKey ?? null;
}

/** Sends `notice` to every device of `person`; forgets devices the push service no longer knows. */
export async function sendToPerson(person: string, notice: Notice): Promise<number> {
	const keys = vapid();
	if (!keys) return 0;
	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT ?? "https://ancora-gray.vercel.app",
		keys.publicKey,
		keys.privateKey,
	);
	const subscriptions = await subscriptionsOf(person);
	let sent = 0;
	await Promise.all(
		subscriptions.map(async (subscription) => {
			try {
				await webpush.sendNotification(subscription, JSON.stringify(notice), { TTL: 86_400 });
				sent += 1;
			} catch (error) {
				const status = (error as { statusCode?: number }).statusCode;
				if (status === 404 || status === 410) {
					await removeSubscription(person, subscription.endpoint);
				}
			}
		}),
	);
	return sent;
}

type Native = Record<string, unknown>;
const variant = (value: unknown): string =>
	Array.isArray(value) ? String(value[0]) : String(value);
const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

function amountText(config: ServerConfig, token: string, stroops: unknown): string {
	const symbol = config.orgAssets.get(token)?.symbol ?? "";
	const units = Number(BigInt(stroops as bigint)) / 10_000_000;
	return `${units.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${symbol}`.trim();
}

/** "450 BlendUSDC to Lisbon Boat Supplies", or "a rule or membership change". */
async function subject(config: ServerConfig, organization: string, request: Native) {
	const [kind, fields] = request.kind as [string, Native];
	if (kind !== "Payment") return "a rule or membership change";
	const to = String(fields.to);
	const book = (await readView(config, organization, "payees").catch(() => [])) as Native[];
	const name = book.find((entry) => String(entry.address) === to)?.name;
	return `${amountText(config, String(fields.token), fields.amount)} to ${name ? String(name) : short(to)}`;
}

/**
 * Called after the relayer submitted `func` successfully. Understands the person's account
 * calling `execute(target, function, args)` on an organization or on the recovery contract.
 */
export async function notifyAfterRelay(config: ServerConfig, func: xdr.HostFunction) {
	if (!vapid() || func.switch().name !== "hostFunctionTypeInvokeContract") return;
	const call = func.invokeContract();
	if (call.functionName().toString() !== "execute") return;
	const [targetVal, fnVal, argsVal] = call.args();
	if (!targetVal || !fnVal || !argsVal) return;
	const target = Address.fromScAddress(targetVal.address()).toString();
	const fn = String(scValToNative(fnVal));
	const args = (argsVal.vec() ?? []).map((value) => scValToNative(value));
	const actor = Address.fromScAddress(call.contractAddress()).toString();

	if (target === config.recoveryContract && fn === "start_claim") {
		const person = String(args[0]);
		await sendToPerson(person, {
			title: "ancora Lifeline",
			body: "A guardian started recovering your pass. If this wasn't you, cancel it on your pass page now.",
			url: "/app/me",
			tag: `claim-${person}`,
		});
		return;
	}

	const organization = target;
	const proposed = fn === "propose_payment" || fn === "propose_change";
	const decided = fn === "approve" || fn === "seal" || fn === "decline";
	if (!proposed && !decided) return;
	const info = (await readView(config, organization, "info")) as Native;
	const orgName = String(info.name);
	const id = proposed
		? Number(await readView(config, organization, "request_count"))
		: Number(args[1]);
	const request = (await readView(config, organization, "request", [
		nativeToScVal(id, { type: "u64" }),
	])) as Native;
	const status = variant(request.status);
	const requester = String(request.requester);
	const what = await subject(config, organization, request);
	const url = `/app/approvals/${id}`;

	if (proposed && status === "Pending") {
		const members = (await readView(config, organization, "members")) as Native[];
		await Promise.all(
			members
				.map((member) => String(member.address))
				.filter((member) => member !== actor)
				.map((member) =>
					sendToPerson(member, {
						title: orgName,
						body: `Waiting for approval: ${what}.`,
						url,
						tag: `request-${organization}-${id}`,
					}),
				),
		);
		return;
	}
	if (decided && requester !== actor) {
		const outcome: Record<string, string> = {
			Executed: `Done: ${what}.`,
			Declined: `Declined: ${what}.`,
			Scheduled: `Approved: ${what}. It goes ahead after the objection window.`,
			Escrowed: `Approved and set aside: ${what}. It is paid out once both sides confirm.`,
		};
		const body = outcome[status];
		if (!body) return;
		await sendToPerson(requester, {
			title: orgName,
			body,
			url,
			tag: `request-${organization}-${id}`,
		});
	}
}
