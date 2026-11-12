import { describe, expect, it } from "vitest";
import { restoreSession } from "./sessionRestore.ts";

/** A promise the test settles by hand. */
function later<T>() {
	let resolve: (value: T) => void = () => undefined;
	let reject: (error: unknown) => void = () => undefined;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function device(cachedId: string | null, reconnect: () => Promise<string | null>) {
	const log: string[] = [];
	const timeout = later<void>();
	return {
		log,
		timeout,
		deps: {
			cachedId,
			reconnect,
			refresh: async () => {
				log.push("refresh");
			},
			become: async (id: string) => {
				log.push(`become ${id}`);
			},
			forget: () => {
				log.push("forget");
			},
			wait: () => timeout.promise,
		},
	};
}

const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("restoreSession", () => {
	it("keeps the cached pass when the kit finds the same session", async () => {
		const { deps, log } = device("CME", async () => "CME");
		await restoreSession(deps);
		expect(log).toEqual(["refresh"]);
	});

	it("follows another pass the kit found", async () => {
		const { deps, log } = device("CME", async () => "COTHER");
		await restoreSession(deps);
		expect(log).toEqual(["refresh", "become COTHER"]);
	});

	it("signs in a device that had no cache", async () => {
		const { deps, log } = device(null, async () => "CME");
		await restoreSession(deps);
		expect(log).toEqual(["become CME"]);
	});

	it("forgets a cached pass whose session is gone", async () => {
		const { deps, log } = device("CME", async () => null);
		await restoreSession(deps);
		expect(log).toEqual(["refresh", "forget"]);
	});

	it("forgets a cached pass when the kit fails", async () => {
		const { deps, log } = device("CME", async () => {
			throw new Error("no credential");
		});
		await restoreSession(deps);
		expect(log).toEqual(["refresh", "forget"]);
	});

	it("does nothing on a device with neither cache nor session", async () => {
		const { deps, log } = device(null, async () => null);
		await restoreSession(deps);
		expect(log).toEqual([]);
	});

	it("stops waiting on a slow network without signing the person out", async () => {
		const kit = later<string | null>();
		const { deps, log, timeout } = device("CME", () => kit.promise);

		const restored = restoreSession(deps);
		timeout.resolve();
		await restored;
		expect(log).toEqual(["refresh"]);

		kit.resolve("CME");
		await settled();
		expect(log).toEqual(["refresh"]);
	});

	it("forgets the pass after a slow answer that found no session", async () => {
		const kit = later<string | null>();
		const { deps, log, timeout } = device("CME", () => kit.promise);

		const restored = restoreSession(deps);
		timeout.resolve();
		await restored;
		kit.resolve(null);
		await settled();

		expect(log).toEqual(["refresh", "forget"]);
	});

	it("forgets the pass when the kit fails after the screen stopped waiting", async () => {
		const kit = later<string | null>();
		const { deps, log, timeout } = device("CME", () => kit.promise);

		const restored = restoreSession(deps);
		timeout.resolve();
		await restored;
		kit.reject(new Error("no credential"));
		await settled();

		expect(log).toEqual(["refresh", "forget"]);
	});
});
