import { listDeployments, testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import type { DemoMode } from "../workspace/resolveDataSource.ts";

export type AdminHealth = {
	demo: { mode: DemoMode; updatedAt: string | null };
	rpc: { ok: boolean; ledger: number | null; protocol: string | null; latencyMs: number };
	rent: { stateBytes: number; targetBytes: number; ratePerKb: number; escalated: boolean } | null;
	contracts: { label: string; id: string; ok: boolean }[];
	operator: {
		address: string;
		xlmStroops: string;
		floats: { symbol: string; token: string; stroops: string }[];
	} | null;
	relayer: { allowedOrigins: string[]; rpcUrl: string };
};

export class AdminError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

async function adminRequest<T>(passphrase: string, body: Record<string, unknown>): Promise<T> {
	let response: Response;
	try {
		response = await fetch("/api/admin", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Ancora-Admin": passphrase },
			body: JSON.stringify(body),
		});
	} catch {
		throw new AdminError("ancora's server is unreachable right now.", 0);
	}
	const payload = (await response.json().catch(() => null)) as {
		success?: boolean;
		data?: T;
		error?: string;
	} | null;
	if (!payload?.success || payload.data === undefined) {
		throw new AdminError(
			payload?.error ?? `The request failed (${response.status}).`,
			response.status,
		);
	}
	return payload.data;
}

export function fetchAdminHealth(passphrase: string): Promise<AdminHealth> {
	return adminRequest<AdminHealth>(passphrase, {
		action: "health",
		nativeToken: testnetConfig?.nativeToken ?? null,
		contracts: testnetConfig ? listDeployments(testnetConfig) : [],
	});
}

export function setDemoMode(
	passphrase: string,
	mode: DemoMode,
): Promise<{ demo: AdminHealth["demo"] }> {
	return adminRequest(passphrase, { action: "set-mode", mode });
}
