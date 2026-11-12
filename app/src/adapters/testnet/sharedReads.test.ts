import { describe, expect, it } from "vitest";
import { SharedReads } from "./sharedReads.ts";

function counted() {
	let calls = 0;
	return {
		load: async () => {
			calls += 1;
			return calls;
		},
		calls: () => calls,
	};
}

describe("SharedReads", () => {
	it("gives everyone who asks within the time the same read", async () => {
		let now = 1_000;
		const reads = new SharedReads(() => now);
		const read = counted();

		const first = reads.remember("passkeys", 60_000, read.load);
		now += 59_999;
		const second = reads.remember("passkeys", 60_000, read.load);

		expect(await first).toBe(1);
		expect(await second).toBe(1);
		expect(read.calls()).toBe(1);
	});

	it("reads again once the time has passed", async () => {
		let now = 1_000;
		const reads = new SharedReads(() => now);
		const read = counted();

		await reads.remember("passkeys", 60_000, read.load);
		now += 60_000;

		expect(await reads.remember("passkeys", 60_000, read.load)).toBe(2);
	});

	it("keeps reads under different keys apart", async () => {
		const reads = new SharedReads(() => 0);
		const read = counted();

		await reads.remember("lifeline:a", 1_000, read.load);
		await reads.remember("lifeline:b", 1_000, read.load);

		expect(read.calls()).toBe(2);
	});

	it("forgets by prefix and leaves the rest", async () => {
		const reads = new SharedReads(() => 0);
		const lifeline = counted();
		const passkeys = counted();
		await reads.remember("lifeline:a", 1_000, lifeline.load);
		await reads.remember("passkeys", 1_000, passkeys.load);

		reads.forget("lifeline:");
		await reads.remember("lifeline:a", 1_000, lifeline.load);
		await reads.remember("passkeys", 1_000, passkeys.load);

		expect(lifeline.calls()).toBe(2);
		expect(passkeys.calls()).toBe(1);
	});

	it("forgets everything when cleared", async () => {
		const reads = new SharedReads(() => 0);
		const read = counted();
		await reads.remember("passkeys", 1_000, read.load);

		reads.clear();
		await reads.remember("passkeys", 1_000, read.load);

		expect(read.calls()).toBe(2);
	});
});
