import { describe, expect, it } from "vitest";
import type { OrgAccount } from "./account.ts";
import {
	formatPrivateNote,
	parsePrivateNote,
	privateNotesOf,
	revealNotes,
	UNREADABLE_NOTE,
} from "./privateNote.ts";
import type { ApprovalRequest } from "./rules/requests.ts";

const secret = formatPrivateNote(2, "c2VjcmV0");
const other = formatPrivateNote(1, "b3RoZXI");

function account(requests: ApprovalRequest[]): OrgAccount {
	return {
		requests,
		standingOrders: null,
		discussions: { r1: [{ id: "d1", text: secret } as never] },
	} as unknown as OrgAccount;
}

const payment = (note: string) =>
	({ id: "r1", kind: "payment", note }) as unknown as ApprovalRequest;

describe("private notes", () => {
	it("round-trip their format and refuse anything else", () => {
		expect(parsePrivateNote(secret)).toEqual({ epoch: 2, payload: "c2VjcmV0" });
		expect(parsePrivateNote("Coach fees")).toBeNull();
		expect(parsePrivateNote("enc1:x:abc")).toBeNull();
	});

	it("are found everywhere they can appear and replaced by what this device read", () => {
		const raw = account([payment(secret), payment("Plain"), payment(other)]);
		expect(new Set(privateNotesOf(raw))).toEqual(new Set([secret, other]));
		const shown = revealNotes(raw, new Map([[secret, "Coach fees"]]));
		const notes = shown.requests.map((r) => (r.kind === "payment" ? r.note : ""));
		expect(notes).toEqual(["Coach fees", "Plain", UNREADABLE_NOTE]);
		expect(shown.discussions.r1?.[0]?.text).toBe("Coach fees");
	});
});
