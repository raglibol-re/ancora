import { expect, test } from "@playwright/test";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// The core path a new organization takes, on the real Stellar testnet: create a pass, sign out
// and back in on the same device (the wallet index), found an organization, take test money,
// pay someone. Every step is a real transaction; the operator sponsors the fees.

// The demo operator's account holds a BlendUSDC trustline, so it can receive a test payment.
const RECIPIENT = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const name = `E2E ${stamp}`;

test("a new organization goes from passkey to first payment", async ({ page }) => {
	await addVirtualPasskey(page);
	// No step may end in a message that something failed.
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));

	await test.step("create a pass", async () => {
		await page.goto("/app");
		await expect(page.getByRole("heading", { name: "Welcome to ancora" })).toBeVisible();
		await page.getByLabel("Your name").fill(name);
		await page.getByRole("button", { name: "Create my passkey" }).click();
		// The account exists first, the name follows in a second transaction: wait for both.
		await expect(page.getByText(name).first()).toBeVisible();
	});

	await test.step("sign out and back in with the same passkey", async () => {
		await page.goto("/app/me");
		await page.getByRole("button", { name: "Sign out" }).click();
		await expect(page.getByRole("heading", { name: "Welcome to ancora" })).toBeVisible();
		await page.getByRole("button", { name: "Sign in with my passkey" }).click();
		// The same pass, with its name read back from the registry.
		await expect(page.getByText(name).first()).toBeVisible();
		await expect(page.getByRole("alert")).toHaveCount(0);
	});

	await test.step("found an organization", async () => {
		await page.goto("/app/new");
		await page.getByLabel("Name").fill(`E2E club ${stamp}`);
		await page.getByRole("button", { name: "Create organization" }).click();
		await expect(page).toHaveURL(/\/app\/rules$/);
	});

	await test.step("take test money", async () => {
		await page.goto("/app");
		await page
			.getByRole("button", { name: /BlendUSDC/ })
			.first()
			.click();
		await page.getByRole("button", { name: "Add BlendUSDC" }).click();
		await page.getByRole("button", { name: "Add test BlendUSDC" }).click();
		await expect(page.getByText("Test BlendUSDC arrived on the account.")).toBeVisible();
	});

	await test.step("pay someone", async () => {
		await page.goto("/app/pay");
		// Option values are the token contracts; this is BlendUSDC.
		await page
			.getByLabel("Pay with")
			.selectOption("CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU");
		await page.getByLabel("Recipient").selectOption("new");
		await page.getByLabel("Name").fill("Operator");
		await page.getByLabel(/Stellar address|Account/).fill(RECIPIENT);
		await page.getByLabel(/^Amount/).fill("5");
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(page).toHaveURL(/\/app\/approvals\/\d+$/);
	});

	expect(failures).toEqual([]);
});
