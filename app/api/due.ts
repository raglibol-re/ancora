import { Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { requireAdmin } from "./_lib/adminAuth.js";
import { isOrganization } from "./_lib/contracts.js";
import { runDueOrders, runDueRequests } from "./_lib/dueOrders.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { rememberOrganization } from "./_lib/organizationIndex.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Work that was decided already and only needs someone to send it, in one function (Vercel's
// Hobby plan allows twelve per deployment). The contracts let anyone do these; the operator
// only pays the fee.
// - GET: every due standing order and every request past its objection window, for every known
//   organization. Vercel's cron calls it daily with CRON_SECRET; the demo admin with the passphrase.
// - POST { organization, requestId }: execute one request whose objection window has passed.
// - POST { organization, orderId }: run one due standing order.
// - POST { organization }: add an organization to the scheduler's index.

export const config = { maxDuration: 120 };

const runAllDue = apiHandler("GET", async (request) => {
	const secret = process.env.CRON_SECRET;
	const fromCron =
		secret !== undefined && request.headers.get("authorization") === `Bearer ${secret}`;
	if (!fromCron) requireAdmin(request, process.env.ADMIN_PASSPHRASE);
	const settings = serverConfig();
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const orders = await runDueOrders(settings, operator);
	const requests = await runDueRequests(settings, operator);
	return { ...orders, requests };
});

const positive = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

const runOne = apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { organization, requestId, orderId } = await readJsonObject(request);
	if (typeof organization !== "string" || !StrKey.isValidContract(organization)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	if (!(await isOrganization(settings, organization))) {
		throw new RequestError("That contract is not an ancora organization.", 403);
	}
	if (requestId === undefined && orderId === undefined) {
		await rememberOrganization(organization);
		return { indexed: true };
	}
	const [fn, id] = positive(requestId)
		? (["execute", requestId] as const)
		: positive(orderId)
			? (["run_standing_order", orderId] as const)
			: [null, 0];
	if (!fn) throw new RequestError("Send the request id or the standing order id.");
	const hash = await invokeAsServer(
		settings,
		Keypair.fromSecret(required("DEPLOYER_SECRET")),
		new Contract(organization).call(fn, nativeToScVal(id, { type: "u64" })),
	);
	return { hash };
});

export default {
	fetch(request: Request): Promise<Response> {
		return request.method === "GET" ? runAllDue.fetch(request) : runOne.fetch(request);
	},
};
