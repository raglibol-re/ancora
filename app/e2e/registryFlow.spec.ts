import { expect, test } from "@playwright/test";
import { createPass, foundOrganization, stamp } from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// A name for the treasury on the real Stellar Registry: the founder checks a name, registers it
// with their passkey, and ancora's server remembers it (the registry only resolves names to
// contracts), so it is still there after a reload and verified against the registry.

const founderName = `E2E registry founder ${stamp}`;
const organization = `E2E registry ${stamp}`;
/** Lowercase letters, digits and dashes; the stamp keeps runs apart on the shared registry. */
const registryName = `e2e-${stamp}`;

test("the founder registers the organization's name on the Stellar Registry", async ({ page }) => {
	await addVirtualPasskey(page);
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));

	await test.step("create a pass and found an organization", async () => {
		await createPass(page, founderName);
		await foundOrganization(page, organization);
	});

	await test.step("the name is free", async () => {
		await page.goto("/app/settings");
		await page.locator("#registry-name").fill(registryName);
		await page.getByRole("button", { name: "Check availability" }).click();
		await expect(page.getByText("” is free.")).toBeVisible();
	});

	await test.step("register it with the passkey", async () => {
		await page.getByRole("button", { name: "Register with my passkey" }).click();
		await expect(
			page.getByText(
				`Registered. ${organization} is now "${registryName}" on the Stellar Registry.`,
			),
		).toBeVisible();
	});

	await test.step("after a reload it is remembered and points to this contract", async () => {
		await page.reload();
		await expect(page.getByText("Registered as")).toBeVisible();
		await expect(page.getByText(registryName, { exact: true })).toBeVisible();
		await expect(page.getByText("· points to this contract")).toBeVisible();
	});

	await test.step("the same name is now taken", async () => {
		await page.locator("#registry-name").fill(registryName);
		await page.getByRole("button", { name: "Check availability" }).click();
		await expect(page.getByText("” is already taken on the registry.")).toBeVisible();
	});

	expect(failures).toEqual([]);
});
