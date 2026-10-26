import { rpc } from "@stellar/stellar-sdk";
import { serverConfig } from "../../../_lib/serverConfig.js";
import { findWalletBirth } from "../../../_lib/walletBirth.js";
import {
	completeLookup,
	firstSeenLedger,
	type IndexedContract,
	UPSTREAM_INDEXERS,
} from "../../../_lib/walletIndex.js";

// The passkey kit connects a passkey to its smart account only once it can verify the account's
// creation ("birth"), and asks an indexer for it. Mercury's indexer finds ancora's wallets but
// leaves their birth empty, which turns every sign-in on a new device (and every page reload
// once the local session is gone) into a refusal. This index answers in Mercury's format: the
// candidate wallets come from Mercury, the creation transaction from the ledger, and the kit
// still verifies that transaction against the chain itself. Public data; GET only.

export const config = { maxDuration: 30 };

const UPSTREAM_TIMEOUT_MS = 8_000;

export default {
	async fetch(request: Request): Promise<Response> {
		if (request.method !== "GET") {
			return Response.json({ error: "Use GET." }, { status: 405 });
		}
		const credentialId = decodeURIComponent(
			new URL(request.url).pathname.split("/").at(-1) ?? "",
		).toLowerCase();
		if (!/^[0-9a-f]{8,}$/.test(credentialId)) {
			return Response.json(
				{ error: "Send the passkey's credential id as lowercase hex." },
				{ status: 400 },
			);
		}
		const settings = serverConfig();
		const server = new rpc.Server(settings.rpcUrl);
		const upstream = UPSTREAM_INDEXERS[settings.networkPassphrase];
		const [candidates, latest] = await Promise.all([
			upstream ? upstreamCandidates(`${upstream}/api/lookup/${credentialId}`) : [],
			server.getLatestLedger().then((ledger) => ledger.sequence),
		]);
		const births = await Promise.all(
			candidates.map((contract) => {
				const seen = firstSeenLedger(contract);
				if (contract.incomplete === false || seen === null) return null;
				return findWalletBirth(server, settings.networkPassphrase, contract.contract_id, seen);
			}),
		);
		return Response.json(completeLookup(credentialId, candidates, births, latest), {
			headers: { "cache-control": "no-store" },
		});
	},
};

/** Mercury's candidates for the credential; none when it can't be reached or answers oddly. */
async function upstreamCandidates(url: string): Promise<IndexedContract[]> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
		if (!response.ok) return [];
		const body: unknown = await response.json();
		const contracts =
			body && typeof body === "object" ? (body as { contracts?: unknown }).contracts : null;
		if (!Array.isArray(contracts)) return [];
		return contracts.filter(
			(contract): contract is IndexedContract =>
				!!contract &&
				typeof contract === "object" &&
				typeof (contract as { contract_id?: unknown }).contract_id === "string",
		);
	} catch {
		// The upstream is a convenience for discovery; without it the kit reports no candidate.
		return [];
	}
}
