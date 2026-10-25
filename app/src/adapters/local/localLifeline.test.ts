import { describe, expect, it } from "vitest";
import { SampleDataSource } from "../sample/sampleDataSource.ts";

const start = Date.UTC(2026, 9, 25, 12);

function source() {
	let now = start;
	const ds = new SampleDataSource(null, () => now);
	return { ds, advance: (ms: number) => (now += ms) };
}

describe("LocalLifeline (simulated recovery)", () => {
	it("seeds a plan for Inês and lists her for her guardians", async () => {
		const { ds } = source();
		const mine = await ds.lifeline.overview("ines");
		expect(mine.ok && mine.value.plan).toMatchObject({ threshold: 2, waitSeconds: 120 });
		const tomas = await ds.lifeline.overview("tomas");
		expect(tomas.ok && tomas.value.protecting.map((p) => p.personId)).toEqual(["ines"]);
	});

	it("rejects bad plans with the same reasons as the contract", async () => {
		const { ds } = source();
		const self = await ds.lifeline.setPlan("joao", {
			guardians: ["joao"],
			threshold: 1,
			waitSeconds: 120,
		});
		expect(self.ok).toBe(false);
		const wait = await ds.lifeline.setPlan("joao", {
			guardians: ["ines"],
			threshold: 1,
			waitSeconds: 30,
		});
		expect(wait.ok).toBe(false);
	});

	it("walks a claim from start to handover, respecting threshold and time", async () => {
		const { ds, advance } = source();
		const stranger = await ds.lifeline.startClaim("ines", "joao", "ines-2");
		expect(stranger.ok).toBe(false);
		expect((await ds.lifeline.startClaim("ines", "tomas", "ines-2")).ok).toBe(true);
		expect((await ds.lifeline.finishClaim("ines")).ok).toBe(false);
		expect((await ds.lifeline.approveClaim("ines", "marta")).ok).toBe(true);
		expect((await ds.lifeline.finishClaim("ines")).ok).toBe(false);
		advance(120_000);
		const finished = await ds.lifeline.finishClaim("ines");
		expect(finished.ok && finished.value.successor).toBe("ines-2");
		const club = ds.getSnapshot().accounts.find((a) => a.org.id === "tejo-rowing");
		expect(club?.org.members.some((m) => m.personId === "ines-2" && m.roleId === "treasurer")).toBe(
			true,
		);
		expect(club?.org.members.some((m) => m.personId === "ines")).toBe(false);
		expect(ds.getSnapshot().people.some((p) => p.id === "ines-2")).toBe(true);
		const status = await ds.lifeline.claimOf("ines");
		expect(status.ok && status.value.recoveredTo).toBe("ines-2");
	});

	it("lets the old pass cancel while the claim waits", async () => {
		const { ds, advance } = source();
		await ds.lifeline.startClaim("ines", "tomas", "ines-2");
		await ds.lifeline.approveClaim("ines", "marta");
		expect((await ds.lifeline.cancelClaim("ines")).ok).toBe(true);
		advance(120_000);
		expect((await ds.lifeline.finishClaim("ines")).ok).toBe(false);
		const club = ds.getSnapshot().accounts.find((a) => a.org.id === "tejo-rowing");
		expect(club?.org.members.some((m) => m.personId === "ines")).toBe(true);
	});
});
