import { describe, expect, it } from "vitest";
import { euros } from "../money.ts";
import type { Result } from "../result.ts";
import type { RuleError } from "./model.ts";
import {
	advanceRequest,
	approveRequest,
	createGovernanceRequest,
	createPaymentRequest,
	declineRequest,
	markExecuted,
	sealRequest,
} from "./requests.ts";
import { club, company } from "./testOrgs.ts";

const T0 = Date.UTC(2026, 9, 25, 12);
const HOUR = 3_600_000;

function unwrap<T>(result: Result<T, RuleError>): T {
	if (!result.ok) throw new Error(`Expected ok, got ${result.error.code}`);
	return result.value;
}

const payment = (requesterId: string, amount: number, recipientIsNew = false, token = "eurc") => ({
	id: "req-1",
	requesterId,
	token,
	amount,
	recipientId: "acme",
	recipientIsNew,
	note: "",
});

describe("payment requests", () => {
	it("take the strictest tier and the seal in another currency, and refuse unknown assets", () => {
		const request = unwrap(
			createPaymentRequest(club(), payment("max", euros(50), false, "usdc"), T0),
		);
		expect(request.currency).toBe("USD");
		expect(request.evaluation).toMatchObject({ tierIndex: 2, sealRequired: true });
		expect(request.status).toBe("pending");
		expect(
			createPaymentRequest(club(), payment("max", euros(50), false, "nope"), T0),
		).toMatchObject({ error: { code: "unknown-asset" } });
	});

	it("are ready immediately when the tier needs no approval", () => {
		const request = unwrap(createPaymentRequest(club(), payment("max", euros(50)), T0));
		expect(request.status).toBe("ready");
	});

	it("wait for approvals and become ready when complete", () => {
		const org = club();
		const created = unwrap(createPaymentRequest(org, payment("max", euros(500)), T0));
		expect(created.status).toBe("pending");
		const approved = unwrap(approveRequest(org, created, "bo", T0 + 1));
		expect(approved.status).toBe("ready");
		expect(unwrap(markExecuted(approved)).status).toBe("executed");
	});

	it("are scheduled during the objection window, then ready", () => {
		const org = club();
		let request = unwrap(createPaymentRequest(org, payment("tess", euros(5_000)), T0));
		request = unwrap(approveRequest(org, request, "bo", T0));
		request = unwrap(approveRequest(org, request, "bea", T0 + HOUR));
		expect(request).toMatchObject({ status: "scheduled", executeAfter: T0 + 49 * HOUR });
		expect(advanceRequest(request, T0 + 49 * HOUR - 1).status).toBe("scheduled");
		expect(markExecuted(request).ok).toBe(false);
		expect(advanceRequest(request, T0 + 49 * HOUR).status).toBe("ready");
	});

	it("can be objected to during the objection window", () => {
		const org = club();
		let request = unwrap(createPaymentRequest(org, payment("max", euros(5_000)), T0));
		request = unwrap(approveRequest(org, request, "bo", T0));
		request = unwrap(approveRequest(org, request, "bea", T0));
		const objected = unwrap(declineRequest(org, request, "tess"));
		expect(objected).toMatchObject({ status: "declined", declinedBy: "tess" });
	});

	it("reject the requester's own approval, repeat approvals and too-low roles", () => {
		const org = club();
		const request = unwrap(createPaymentRequest(org, payment("bo", euros(500)), T0));
		expect(approveRequest(org, request, "bo", T0)).toMatchObject({
			error: { code: "requester-cannot-approve" },
		});
		expect(approveRequest(org, request, "max", T0)).toMatchObject({
			error: { code: "role-cannot-approve" },
		});
		expect(approveRequest(org, request, "stranger", T0)).toMatchObject({
			error: { code: "not-a-member" },
		});
		const twoBoard = unwrap(createPaymentRequest(org, payment("max", euros(5_000)), T0));
		const once = unwrap(approveRequest(org, twoBoard, "bo", T0));
		expect(approveRequest(org, once, "bo", T0)).toMatchObject({
			error: { code: "already-approved" },
		});
	});

	it("need the seal above the threshold before they complete", () => {
		const org = company();
		let request = unwrap(createPaymentRequest(org, payment("fin", euros(60_000)), T0));
		request = unwrap(approveRequest(org, request, "dana", T0));
		request = unwrap(approveRequest(org, request, "dirk", T0));
		expect(request.status).toBe("pending");
		expect(sealRequest(org, request, "fin", T0)).toMatchObject({
			error: { code: "requester-cannot-approve" },
		});
		request = unwrap(sealRequest(org, request, "dana", T0));
		expect(request).toMatchObject({ status: "ready", sealedBy: "dana" });
	});

	it("refuse the seal when it isn't required", () => {
		const org = company();
		const request = unwrap(createPaymentRequest(org, payment("fin", euros(5_000)), T0));
		expect(sealRequest(org, request, "dana", T0)).toMatchObject({
			error: { code: "seal-not-required" },
		});
	});

	it("can be cancelled by the requester but not declined by a too-low role", () => {
		const org = club();
		const request = unwrap(createPaymentRequest(org, payment("bo", euros(500)), T0));
		expect(declineRequest(org, request, "max")).toMatchObject({
			error: { code: "cannot-decline" },
		});
		expect(unwrap(declineRequest(org, request, "bo")).status).toBe("declined");
	});

	it("reject invalid amounts and non-members", () => {
		expect(createPaymentRequest(club(), payment("max", 0), T0)).toMatchObject({
			error: { code: "invalid-amount" },
		});
		expect(createPaymentRequest(club(), payment("max", 10.5), T0).ok).toBe(false);
		expect(createPaymentRequest(club(), payment("stranger", euros(5)), T0)).toMatchObject({
			error: { code: "not-a-member" },
		});
	});
});

describe("governance requests", () => {
	it("use the strictest tier, including its objection window", () => {
		const org = club();
		const change = { type: "addMember" as const, personId: "nina", roleId: "member" };
		let request = unwrap(
			createGovernanceRequest(org, { id: "g-1", requesterId: "max", change }, T0),
		);
		expect(request.evaluation.approvals).toEqual([{ roleId: "board", count: 2 }]);
		request = unwrap(approveRequest(org, request, "bo", T0));
		request = unwrap(approveRequest(org, request, "bea", T0));
		expect(request.status).toBe("scheduled");
	});

	it("are refused up front when the change itself is invalid", () => {
		const change = { type: "addMember" as const, personId: "bo", roleId: "member" };
		expect(
			createGovernanceRequest(club(), { id: "g-2", requesterId: "max", change }, T0),
		).toMatchObject({ error: { code: "already-a-member" } });
	});
});
