import { Contract, Keypair, rpc, xdr } from "@stellar/stellar-sdk";
import { tokenBalance } from "../../shared/tokenBalance.js";
import { required, type ServerConfig } from "./serverConfig.js";

// Read-only checks for the demo admin's health panel. Nothing here signs anything.

export type RpcHealth = {
	ok: boolean;
	ledger: number | null;
	protocol: string | null;
	latencyMs: number;
};

export async function rpcHealth(config: ServerConfig): Promise<RpcHealth> {
	const started = Date.now();
	try {
		const latest = await new rpc.Server(config.rpcUrl).getLatestLedger();
		return {
			ok: true,
			ledger: latest.sequence,
			protocol: latest.protocolVersion,
			latencyMs: Date.now() - started,
		};
	} catch {
		return { ok: false, ledger: null, protocol: null, latencyMs: Date.now() - started };
	}
}

export type RentHealth = {
	stateBytes: number;
	targetBytes: number;
	/** Current rent in stroops per KB; 1,000 is the floor (mainnet today). */
	ratePerKb: number;
	escalated: boolean;
};

/** Recomputes the protocol's rent curve from the live config, so "why are fees high" is visible. */
export async function rentHealth(config: ServerConfig): Promise<RentHealth | null> {
	try {
		const key = (
			name: "configSettingContractLedgerCostV0" | "configSettingLiveSorobanStateSizeWindow",
		) =>
			xdr.LedgerKey.configSetting(
				new xdr.LedgerKeyConfigSetting({ configSettingId: xdr.ConfigSettingId[name]() }),
			);
		const entries = (
			await new rpc.Server(config.rpcUrl).getLedgerEntries(
				key("configSettingContractLedgerCostV0"),
				key("configSettingLiveSorobanStateSizeWindow"),
			)
		).entries.map((entry) => entry.val.configSetting());
		const costEntry = entries.find((e) => e.switch().name === "configSettingContractLedgerCostV0");
		const windowEntry = entries.find(
			(e) => e.switch().name === "configSettingLiveSorobanStateSizeWindow",
		);
		if (!costEntry || !windowEntry) return null;
		const cost = costEntry.contractLedgerCost();
		const samples = windowEntry.liveSorobanStateSizeWindow().map((s) => Number(s.toString()));
		const stateBytes = samples.reduce((sum, n) => sum + n, 0) / samples.length;
		const targetBytes = Number(cost.sorobanStateTargetSizeBytes().toString());
		const low = Number(cost.rentFee1KbSorobanStateSizeLow().toString());
		const high = Number(cost.rentFee1KbSorobanStateSizeHigh().toString());
		const growth = Number(cost.sorobanStateRentFeeGrowthFactor().toString());
		const span = high - low;
		const ratePerKb =
			stateBytes <= targetBytes
				? Math.max(1000, low + (span * stateBytes) / targetBytes)
				: high + (growth * span * (stateBytes - targetBytes)) / targetBytes;
		return {
			stateBytes,
			targetBytes,
			ratePerKb: Math.round(ratePerKb),
			escalated: stateBytes > targetBytes,
		};
	} catch {
		return null;
	}
}

export type ContractCheck = { label: string; id: string; ok: boolean };

export async function contractsHealth(
	config: ServerConfig,
	contracts: readonly { label: string; id: string }[],
): Promise<ContractCheck[]> {
	const server = new rpc.Server(config.rpcUrl);
	return Promise.all(
		contracts.map(async ({ label, id }) => {
			try {
				const response = await server.getLedgerEntries(new Contract(id).getFootprint());
				return { label, id, ok: response.entries.length > 0 };
			} catch {
				return { label, id, ok: false };
			}
		}),
	);
}

export type OperatorHealth = {
	address: string;
	xlmStroops: string;
	/** Test-money float per accepted stablecoin. */
	floats: { symbol: string; token: string; stroops: string }[];
};

/** The demo operator's floats. It pays sponsored fees and sends test money; it signs for no org. */
export async function operatorHealth(
	config: ServerConfig,
	nativeToken: string,
): Promise<OperatorHealth> {
	const address = Keypair.fromSecret(required("DEPLOYER_SECRET")).publicKey();
	const assets = [...config.orgAssets.values()];
	const [xlm, ...floats] = await Promise.all([
		tokenBalance(config, nativeToken, address).catch(() => 0n),
		...assets.map((asset) => tokenBalance(config, asset.token, address).catch(() => 0n)),
	]);
	return {
		address,
		xlmStroops: xlm.toString(),
		floats: assets.map((asset, index) => ({
			symbol: asset.symbol,
			token: asset.token,
			stroops: (floats[index] ?? 0n).toString(),
		})),
	};
}
