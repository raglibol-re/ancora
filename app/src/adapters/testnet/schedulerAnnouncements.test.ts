import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "../local/workspaceStore.ts";
import { SchedulerAnnouncements } from "./schedulerAnnouncements.ts";

function memoryStorage(): KeyValueStorage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		},
	};
}

describe("announcing organizations to the scheduler", () => {
	it("announces each organization once per device", async () => {
		const storage = memoryStorage();
		const sent: string[] = [];
		const announce = async (organization: string) => {
			sent.push(organization);
			return true;
		};
		await new SchedulerAnnouncements(storage, announce).announceNew(["A", "B"]);
		await new SchedulerAnnouncements(storage, announce).announceNew(["A", "B", "C"]);
		expect(sent).toEqual(["A", "B", "C"]);
	});

	it("announces again what the server didn't take", async () => {
		const sent: string[] = [];
		let up = false;
		const announcements = new SchedulerAnnouncements(memoryStorage(), async (organization) => {
			sent.push(organization);
			return up;
		});
		await announcements.announceNew(["A"]);
		up = true;
		await announcements.announceNew(["A"]);
		await announcements.announceNew(["A"]);
		expect(sent).toEqual(["A", "A"]);
	});

	it("works without storage", async () => {
		const sent: string[] = [];
		const announcements = new SchedulerAnnouncements(null, async (organization) => {
			sent.push(organization);
			return true;
		});
		await announcements.announceNew(["A"]);
		await announcements.announceNew(["A"]);
		expect(sent).toEqual(["A"]);
	});
});
