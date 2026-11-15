import { expect, test } from "@playwright/test";
import { createPass, foundOrganization, readAncoraId, stamp } from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// Lifeline on the real Stellar testnet: the owner of a pass names a guardian, "loses" the pass,
// the guardian confirms a new one, and after the waiting period the new pass completes the
// recovery and holds the owner's position in their organization.

const ownerName = `E2E lifeline owner ${stamp}`;
const guardianName = `E2E guardian ${stamp}`;
const successorName = `E2E new pass ${stamp}`;
const organization = `E2E lifeline ${stamp}`;

test("a guardian helps move a lost pass's positions to a new pass", async ({ browser }) => {
	// Three passes, a recovery plan, a claim and the two-minute demo waiting period.
	test.setTimeout(12 * 60_000);
	const owner = await (await browser.newContext()).newPage();
	const guardian = await (await browser.newContext()).newPage();
	const successor = await (await browser.newContext()).newPage();
	await addVirtualPasskey(owner);
	await addVirtualPasskey(guardian);
	await addVirtualPasskey(successor);
	const failures: string[] = [];
	for (const page of [owner, guardian, successor]) {
		page.on("pageerror", (error) => failures.push(error.message));
	}

	const guardianId = await test.step("the guardian creates a pass", async () => {
		await createPass(guardian, guardianName);
		return readAncoraId(guardian);
	});

	const ownerId = await test.step("the owner creates a pass and an organization", async () => {
		await createPass(owner, ownerName);
		await foundOrganization(owner, organization);
		return readAncoraId(owner);
	});

	await test.step("the owner names the guardian in a recovery plan", async () => {
		await owner.goto("/app/me");
		await expect(owner.locator("#lifeline").getByText("Not protected yet")).toBeVisible();
		await owner.getByRole("button", { name: "Set up Lifeline" }).click();
		await owner.locator("#guardian-id").fill(guardianId);
		await owner.getByRole("button", { name: "Add", exact: true }).click();
		// 1 of 1 and the two-minute demo waiting period are the defaults.
		await expect(owner.locator("#wait")).toHaveValue("120");
		await owner.getByRole("button", { name: "Save plan" }).click();
		await expect(owner.getByText("Your recovery plan is saved.")).toBeVisible();
		await expect(owner.locator("#lifeline").getByText("Protected", { exact: true })).toBeVisible();
	});

	const successorId =
		await test.step("the owner creates a new pass after losing the old one", async () => {
			await createPass(successor, successorName);
			return readAncoraId(successor);
		});

	await test.step("the guardian starts the recovery with the new pass's ID", async () => {
		// The guardian's overview is shared for a short while: look again until the plan shows.
		await expect(async () => {
			await guardian.goto("/app/me");
			await expect(guardian.getByRole("button", { name: "They lost their pass" })).toBeVisible({
				timeout: 10_000,
			});
		}).toPass({ timeout: 90_000 });
		await guardian.getByRole("button", { name: "They lost their pass" }).click();
		await guardian.locator(`#successor-${ownerId}`).fill(successorId);
		await guardian.getByRole("button", { name: "Start recovery" }).click();
		await expect(guardian.getByText(/pass started; your confirmation counts\.$/)).toBeVisible();
	});

	await test.step("the old pass sees the claim and could cancel it", async () => {
		await expect(async () => {
			await owner.goto("/app");
			await expect(owner.getByText("Recovery of your pass started")).toBeVisible({
				timeout: 10_000,
			});
		}).toPass({ timeout: 90_000 });
		await expect(owner.getByRole("button", { name: "Cancel it" })).toBeVisible();
	});

	await test.step("after the waiting period the new pass completes the recovery", async () => {
		await successor.goto("/app/me");
		await successor.locator("#old-pass").fill(ownerId);
		await successor.getByRole("button", { name: "Check status" }).click();
		await expect(successor.getByText(/\(this pass\): 1 of 1 guardians confirmed\./)).toBeVisible();
		await expect(async () => {
			await successor.getByRole("button", { name: "Check status" }).click();
			await expect(successor.getByRole("button", { name: "Complete recovery" })).toBeVisible({
				timeout: 10_000,
			});
		}).toPass({ timeout: 4 * 60_000, intervals: [15_000] });
		await successor.getByRole("button", { name: "Complete recovery" }).click();
		await expect(successor.getByText("Your positions moved to this pass.")).toBeVisible();
		await expect(successor.getByText("Handed over in 1 organization.")).toBeVisible();
	});

	await test.step("the new pass holds the owner's position in the organization", async () => {
		await successor.goto("/app");
		await expect(successor.getByText(organization).first()).toBeVisible();
	});

	expect(failures).toEqual([]);
});
