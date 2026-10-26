import { LocalDataSource } from "../local/localDataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { SAMPLE_ASSETS, seedWorkspace } from "./seedWorkspace.ts";

export const SAMPLE_STORAGE_KEY = "ancora.sample.v8";

/**
 * Labeled demo data that behaves like the real thing: every command goes through the domain
 * engine, payments go out as soon as they're approved. Stays as the demo fallback.
 */
export class SampleDataSource extends LocalDataSource {
	constructor(
		storage: KeyValueStorage | null,
		clock: () => number = Date.now,
		newId: () => string = () => crypto.randomUUID(),
	) {
		super({
			kind: "sample",
			storageKey: SAMPLE_STORAGE_KEY,
			storage,
			payments: "auto",
			seed: seedWorkspace,
			assets: SAMPLE_ASSETS,
			clock,
			newId,
		});
		// Inês keeps a plan: Tomás and Marta can confirm a new pass after two minutes.
		this.lifeline.seedPlan("ines", {
			guardians: ["tomas", "marta"],
			threshold: 2,
			waitSeconds: 120,
		});
	}
}
