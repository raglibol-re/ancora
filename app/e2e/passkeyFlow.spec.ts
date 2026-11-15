import { expect, test } from "@playwright/test";
import { createPass, foundOrganization, stamp } from "./steps.ts";
import { addVirtualPasskey, passkeyIds, removePasskey } from "./virtualPasskey.ts";

// A second passkey on the real Stellar testnet: the person adds one, loses the first, and signs
// in and signs a transaction with the second alone.

const name = `E2E second passkey ${stamp}`;

test("a second passkey signs for the pass after the first is lost", async ({ page }) => {
	const authenticator = await addVirtualPasskey(page);
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));

	const [first] = await test.step("create a pass with one passkey", async () => {
		await createPass(page, name);
		await page.goto("/app/me");
		await expect(page.getByText("One passkey", { exact: true })).toBeVisible();
		return passkeyIds(authenticator);
	});

	await test.step("add a second passkey", async () => {
		await page.getByRole("button", { name: "Add a passkey" }).click();
		await page.locator("#passkey-label").fill("Spare key");
		await page.getByRole("button", { name: "Create and add" }).click();
		await expect(page.getByText("The new passkey can now sign for your account.")).toBeVisible();
		await expect(page.getByText("2 passkeys", { exact: true })).toBeVisible();
		expect(await passkeyIds(authenticator)).toHaveLength(2);
	});

	await test.step("lose the first passkey and sign in with the second", async () => {
		// Destructured from a one-element list: the pass was created with exactly one passkey.
		expect(first).toBeDefined();
		await removePasskey(authenticator, first ?? "");
		await page.getByRole("button", { name: "Sign out" }).click();
		await expect(page.getByRole("heading", { name: "Welcome to ancora" })).toBeVisible();
		await page.getByRole("button", { name: "Sign in with my passkey" }).click();
		await expect(page.getByText(name).first()).toBeVisible();
	});

	await test.step("the second passkey signs a transaction", () =>
		foundOrganization(page, `E2E spare key ${stamp}`));

	expect(failures).toEqual([]);
});
