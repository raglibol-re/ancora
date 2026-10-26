import { Keypair } from "@stellar/stellar-sdk";
import { requireAdmin } from "./_lib/adminAuth.js";
import { runDueOrders } from "./_lib/dueOrders.js";
import { apiHandler } from "./_lib/http.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Runs every due standing order. Called by Vercel's cron (see app/vercel.json) with the
// CRON_SECRET bearer token, or by the demo admin with the passphrase. Anyone could run a due
// order on the contract itself; this only saves members from having to open the app.

export const config = { maxDuration: 120 };

export default apiHandler("GET", async (request) => {
	const secret = process.env.CRON_SECRET;
	const fromCron =
		secret !== undefined && request.headers.get("authorization") === `Bearer ${secret}`;
	if (!fromCron) requireAdmin(request, process.env.ADMIN_PASSPHRASE);
	return runDueOrders(serverConfig(), Keypair.fromSecret(required("DEPLOYER_SECRET")));
});
