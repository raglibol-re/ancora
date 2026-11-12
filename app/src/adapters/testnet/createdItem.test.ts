import { describe, expect, it } from "vitest";
import { CREATED_READS, createdId } from "./createdItem.ts";

const noWait = async () => undefined;

describe("the id of what a command created", () => {
	it("is the one that wasn't there before, not the newest of the old ones", async () => {
		let reads = 0;
		const id = await createdId(
			() => ["8", "7", "6"],
			["7", "6"],
			async () => {
				reads += 1;
			},
			noWait,
		);
		expect(id).toBe("8");
		expect(reads).toBe(0);
	});

	it("reads the chain again until the new item shows", async () => {
		let ids = ["7"];
		let reads = 0;
		const id = await createdId(
			() => ids,
			["7"],
			async () => {
				reads += 1;
				if (reads === 3) ids = ["8", "7"];
			},
			noWait,
		);
		expect(id).toBe("8");
		expect(reads).toBe(3);
	});

	it("gives up with no id, never with an old one", async () => {
		let reads = 0;
		const id = await createdId(
			() => ["7"],
			["7"],
			async () => {
				reads += 1;
			},
			noWait,
		);
		expect(id).toBe("");
		expect(reads).toBe(CREATED_READS);
	});
});
