import type { xdr } from "@stellar/stellar-sdk";
import type { RegistryNameSupport, ReleaseSupport } from "../../domain/dataSource.ts";
import { ok, type Result } from "../../domain/result.ts";
import type { RuleError } from "../../domain/rules/model.ts";
import type { Network } from "./readContract.ts";
import { registerContractArgs, resolveRegistryName } from "./registryNames.ts";
import { contractCodeHash, latestRelease } from "./releases.ts";

// What the Stellar Registry does for an organization: a name for its treasury, and the release
// its contract runs compared with the newest published one.

type Deps = {
	network: Network;
	/** The registry's open channel. */
	registry: string;
	invoke: (
		target: string,
		fn: string,
		args: xdr.ScVal[],
		describeContractError?: (message: string) => string,
	) => Promise<Result<void, RuleError>>;
	post: (path: string, body: Record<string, unknown>) => Promise<Result<unknown, RuleError>>;
	failed: (message: string) => Result<never, RuleError>;
};

/** The name ancora remembered for the organization, from its server; null when it has none. */
async function rememberedName(orgId: string): Promise<string | null> {
	const response = await fetch(`/api/registry-name?org=${encodeURIComponent(orgId)}`).catch(
		() => null,
	);
	const payload = (await response?.json().catch(() => null)) as {
		data?: { name?: unknown };
	} | null;
	return typeof payload?.data?.name === "string" ? payload.data.name : null;
}

/**
 * Registry names. The registry resolves a name to a contract, not the other way round, so
 * ancora's server remembers the name and every read verifies it against the registry.
 */
export function createRegistryNameSupport(deps: Deps): RegistryNameSupport {
	const { network, registry } = deps;
	return {
		channel: () => "unverified",
		current: async (orgId) => {
			const name = await rememberedName(orgId);
			if (!name) return ok({ name: null, verified: false });
			const target = await resolveRegistryName(network, registry, name);
			return ok({ name, verified: target === orgId });
		},
		isFree: async (name) => ok((await resolveRegistryName(network, registry, name)) === null),
		register: async (orgId, actorId, name) => {
			const result = await deps.invoke(
				registry,
				"register_contract",
				registerContractArgs(name, orgId, actorId),
				(message) => `The registry refused the name: ${message}`,
			);
			if (!result.ok) return result;
			const saved = await deps.post("/api/registry-name", { org: orgId, person: actorId, name });
			return saved.ok ? ok(undefined) : saved;
		},
	};
}

/** Which release the organization's contract runs, next to the newest one published. */
export function createReleaseSupport(
	deps: Pick<Deps, "network" | "registry" | "failed">,
): ReleaseSupport {
	const { network, registry } = deps;
	return {
		registry: () => registry,
		status: async (orgId) => {
			try {
				const [running, latest] = await Promise.all([
					contractCodeHash(network, orgId),
					latestRelease(network, registry),
				]);
				return ok({ running, latest });
			} catch (error) {
				return deps.failed(
					`Couldn't read the organization's code from Stellar: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
	};
}
