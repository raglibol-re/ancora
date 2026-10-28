import { Contract, Keypair, nativeToScVal, StrKey } from "@stellar/stellar-sdk";
import { requireAdmin } from "./_lib/adminAuth.js";
import { isOrganization } from "./_lib/contracts.js";
import { runDueOrders } from "./_lib/dueOrders.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { rememberOrganization } from "./_lib/organizationIndex.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Everything that keeps standing orders running, in one function (Vercel's Hobby plan allows
// twelve per deployment):
// - GET: run every due standing order of every known organization. Vercel's cron calls it daily
//   with the CRON_SECRET bearer token; the demo admin may call it with the passphrase.
// - POST { organization, orderId }: run one due order now ("Run now", or the app on opening).
// - POST { organization }: add an organization to the scheduler's index (the app does this for
//   organizations created before the index existed).
// The contract lets anyone run a due order (the member authorized the schedule when setting
// it); the operator only pays the fee.

export const config = { maxDuration: 120 };

const runAllDue = apiHandler("GET", async (request) => {
	const secret = process.env.CRON_SECRET;
	const fromCron =
		secret !== undefined && request.headers.get("authorization") === `Bearer ${secret}`;
	if (!fromCron) requireAdmin(request, process.env.ADMIN_PASSPHRASE);
	return runDueOrders(serverConfig(), Keypair.fromSecret(required("DEPLOYER_SECRET")));
});

const runOneOrIndex = apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const { organization, orderId } = await readJsonObject(request);
	if (typeof organization !== "string" || !StrKey.isValidContract(organization)) {
		throw new RequestError("Send the organization's address (C…).");
	}
	if (!(await isOrganization(settings, organization))) {
		throw new RequestError("That contract is not an ancora organization.", 403);
	}
	if (orderId === undefined) {
		await rememberOrganization(organization);
		return { indexed: true };
	}
	if (typeof orderId !== "number" || !Number.isSafeInteger(orderId) || orderId < 1) {
		throw new RequestError("Send the standing order id.");
	}
	const hash = await invokeAsServer(
		settings,
		Keypair.fromSecret(required("DEPLOYER_SECRET")),
		new Contract(organization).call("run_standing_order", nativeToScVal(orderId, { type: "u64" })),
	);
	return { hash };
});

export default {
	fetch(request: Request): Promise<Response> {
		return request.method === "GET" ? runAllDue.fetch(request) : runOneOrIndex.fetch(request);
	},
};
