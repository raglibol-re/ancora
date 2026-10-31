import { Address, Contract, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import { readView } from "./_lib/contracts.js";
import { apiHandler, RequestError, readJsonObject } from "./_lib/http.js";
import { invokeAsServer } from "./_lib/ledger.js";
import { required, serverConfig } from "./_lib/serverConfig.js";

// Finishing a Lifeline claim needs no signature: the recovery contract checks the guardians'
// confirmations and the waiting period itself. The operator submits it so the person's new pass
// gets its positions back without owning any XLM. Only organizations built with the recovery
// contract take part; older ones are reported so the person knows.

export const config = { maxDuration: 120 };

type Native = Record<string, unknown>;

export default apiHandler("POST", async (request) => {
	const settings = serverConfig();
	const recovery = settings.recoveryContract;
	if (!recovery) throw new RequestError("Server is missing the RECOVERY_CONTRACT setting.", 500);
	const { person } = await readJsonObject(request);
	if (typeof person !== "string" || !StrKey.isValidContract(person)) {
		throw new RequestError("Send the ancora ID of the pass being recovered (C…).");
	}
	const personVal = new Address(person).toScVal();
	const claim = (await readView(settings, recovery, "claim", [personVal])) as Native | null;
	const recovered = (await readView(settings, recovery, "recovered_to", [personVal])) as
		| string
		| null;
	if (!claim && !recovered) {
		throw new RequestError("There is no open recovery for this pass.", 404);
	}
	if (claim && !recovered) {
		const plan = (await readView(settings, recovery, "plan", [personVal])) as Native | null;
		const approvals = Array.isArray(claim.approvals) ? claim.approvals.length : 0;
		const threshold = Number(plan?.threshold ?? 0);
		const readyAt = Number(claim.ready_at ?? 0) * 1000;
		if (approvals < threshold) {
			throw new RequestError(
				`Only ${approvals} of ${threshold} guardians have confirmed the new pass so far.`,
				409,
			);
		}
		if (Date.now() < readyAt) {
			throw new RequestError(
				`The waiting period runs until ${new Date(readyAt).toISOString()}.`,
				409,
			);
		}
	}
	const orgs = (await readView(settings, settings.registryContract, "orgs_of", [
		personVal,
	])) as string[];
	const supported: string[] = [];
	const skipped: string[] = [];
	for (const org of orgs) {
		const info = (await readView(settings, org, "info")) as Native;
		(String(info.recovery ?? "") === recovery ? supported : skipped).push(org);
	}
	const operator = Keypair.fromSecret(required("DEPLOYER_SECRET"));
	const hash = await invokeAsServer(
		settings,
		operator,
		new Contract(recovery).call(
			"finish_claim",
			personVal,
			xdr.ScVal.scvVec(supported.map((org) => new Address(org).toScVal())),
		),
	);
	const successor = (await readView(settings, recovery, "recovered_to", [personVal])) as
		| string
		| null;
	return { successor, recovered: supported, skipped, hash };
});
