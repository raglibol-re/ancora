import { expect, test } from "@playwright/test";
import {
	createPass,
	foundOrganization,
	readAncoraId,
	requestPayment,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// The quantum-safe seal on the real Stellar testnet: the organization requires ML-DSA seals,
// the board member creates their seal key on their own device, approves a payment and seals it;
// the organization's contract checks the ML-DSA signature before the money moves.

const founderName = `E2E sealer founder ${stamp}`;
const approverName = `E2E sealer ${stamp}`;
const APPLIED = "Done. Applied directly during the setup phase.";

test("a payment above the seal threshold goes out on a quantum-safe seal", async ({ browser }) => {
	const founder = await (await browser.newContext()).newPage();
	const approver = await (await browser.newContext()).newPage();
	await addVirtualPasskey(founder);
	await addVirtualPasskey(approver);
	const failures: string[] = [];
	for (const page of [founder, approver]) {
		page.on("pageerror", (error) => failures.push(error.message));
	}

	const approverId = await test.step("the board member creates a pass", async () => {
		await createPass(approver, approverName);
		return readAncoraId(approver);
	});

	await test.step("the founder sets up: small tiers, quantum-safe seals, a board member", async () => {
		await createPass(founder, founderName);
		await foundOrganization(founder, `E2E sealed ${stamp}`);
		await founder.getByLabel(/^Tier 1 upper limit in /).fill("1");
		await founder.getByLabel(/^Security seal from/).fill("1");
		await founder.getByRole("button", { name: "Save changes" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
		await founder.goto("/app/settings");
		await founder.getByRole("button", { name: "Require quantum-safe seals" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
		await founder.goto("/app/rules");
		await founder.locator("#invite-person").fill(approverId);
		await founder.locator("#invite-role").selectOption("board");
		await founder.getByRole("button", { name: "Add person" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
	});

	const requestUrl = await test.step("the founder asks to pay 5", async () => {
		await takeTestMoney(founder, founderName);
		await requestPayment(founder, "Operator", "5");
		await expect(founder.getByText("Waiting for approval").first()).toBeVisible();
		return new URL(founder.url()).pathname;
	});

	await test.step("the board member creates their seal key on this device", async () => {
		await approver.goto("/app/settings");
		await approver.getByRole("button", { name: "Create my seal key on this device" }).click();
		await expect(approver.getByText("Your seal key is on this device")).toBeVisible();
	});

	await test.step("the board member approves and seals with the key", async () => {
		await approver.goto(requestUrl);
		await approver.getByRole("button", { name: "Approve" }).click();
		await expect(approver.getByRole("button", { name: "Add security seal" })).toBeVisible();
		await approver.getByRole("button", { name: "Add security seal" }).click();
		await approver.getByRole("button", { name: "Sign with seal" }).click();
		await expect(approver.getByRole("button", { name: "Add security seal" })).toBeHidden();
	});

	await test.step("the contract checked the seal and paid out", async () => {
		await founder.reload();
		await expect(founder.getByText("Done").first()).toBeVisible();
	});

	expect(failures).toEqual([]);
});
