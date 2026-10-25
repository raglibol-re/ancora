import { LocalDataSource } from "../local/localDataSource.ts";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { seedWorkspace } from "./seedWorkspace.ts";

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
			storageKey: "ancora.sample.v2",
			storage,
			payments: "auto",
			seed: seedWorkspace,
			clock,
			newId,
		});
	}
}
