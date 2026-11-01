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

// Four eyes on the real Stellar testnet: two people on two devices, each with their own passkey.
// The founder lowers the first tier so a small payment needs a board member, invites the second
// pass as one, and asks to pay; the payment waits until the board member approves from their own
// inbox, and the organization's contract pays it out on that approval.

const founderName = `E2E founder ${stamp}`;
const approverName = `E2E board ${stamp}`;
// What the app says once a setup-phase change is on-chain.
const APPLIED = "Done. Applied directly during the setup phase.";

test("a payment waits for a second person and goes out on their approval", async ({ browser }) => {
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

	await test.step("the founder creates a pass and an organization", async () => {
		await createPass(founder, founderName);
		await foundOrganization(founder, `E2E four eyes ${stamp}`);
	});

	await test.step("from 1 on, payments need a board member", async () => {
		// Still the setup phase: the founder's rule change applies directly, on-chain.
		const firstTier = founder.getByLabel(/^Tier 1 upper limit in /);
		await firstTier.fill("1");
		await founder.getByRole("button", { name: "Save changes" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
		await founder.reload();
		await expect(founder.getByLabel(/^Tier 1 upper limit in /)).toHaveValue("1");
	});

	await test.step("the founder invites the second pass to the board", async () => {
		await founder.locator("#invite-person").fill(approverId);
		await founder.locator("#invite-role").selectOption("board");
		await founder.getByRole("button", { name: "Add person" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
		await expect(founder.getByText(approverName).first()).toBeVisible();
	});

	await test.step("the founder takes test money and asks to pay 5", async () => {
		await takeTestMoney(founder, founderName);
		await requestPayment(founder, "Operator", "5");
		await expect(founder.getByText("Waiting for approval").first()).toBeVisible();
	});

	await test.step("the board member approves from their inbox", async () => {
		// The registry lists the new organization for the board member; a fresh read shows it.
		await approver.goto("/app/inbox");
		const approve = approver.getByRole("button", { name: "Approve" });
		await expect(approve).toHaveCount(1);
		await approve.click();
		await expect(approver.getByText("You're all caught up.")).toBeVisible();
	});

	await test.step("the contract paid it out", async () => {
		await founder.reload();
		await expect(founder.getByText("Done").first()).toBeVisible();
		await expect(founder.getByText("Waiting for approval")).toHaveCount(0);
	});

	expect(failures).toEqual([]);
});
