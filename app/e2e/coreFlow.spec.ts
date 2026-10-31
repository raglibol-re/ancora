import { expect, test } from "@playwright/test";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// The core path a new organization takes, on the real Stellar testnet: create a pass, sign out
// and back in on the same device (the wallet index), found an organization, take test money,
// pay someone. Every step is a real transaction; the operator sponsors the fees.

// The demo operator's account holds a BlendUSDC trustline, so it can receive a test payment.
const RECIPIENT = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";
// The testnet stablecoins an organization accepts (BlendUSDC, Circle USDC, Circle EURC).
const TOKENS = [
	"CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
	"CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
	"CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
];
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

	await test.step("add a role of the organization's own", async () => {
		// Still the setup phase: the founder's change applies directly, on-chain.
		await page.locator("#role-name").fill("Coach");
		await page.getByRole("button", { name: "Add role" }).click();
		await page.getByRole("button", { name: "Save roles" }).click();
		await expect(page.getByRole("button", { name: "Save roles" })).toBeHidden();
		await page.reload();
		await expect(page.getByRole("button", { name: "Remove Coach" })).toBeVisible();
	});

	await test.step("take test money", async () => {
		await page.goto("/app");
		await expect(page.getByText(name).first()).toBeVisible();
		await page
			.getByRole("button", { name: /BlendUSDC/ })
			.first()
			.click();
		await expect(page.getByRole("dialog", { name: "BlendUSDC" })).toBeVisible();
		await page.getByRole("button", { name: "Add BlendUSDC" }).click();
		await expect(page.getByRole("dialog", { name: "Add BlendUSDC" })).toBeVisible();
		await page.getByRole("button", { name: "Add test BlendUSDC" }).click();
		await expect(page.getByText("Test BlendUSDC arrived on the account.")).toBeVisible();
	});

	await test.step("pay someone", async () => {
		await page.goto("/app/pay");
		// Option values are the token contracts; this is BlendUSDC.
		await page
			.locator("#asset")
			.selectOption("CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU");
		await page.locator("#payee").selectOption("new");
		await page.locator("#payee-name").fill("Operator");
		await page.locator("#payee-account").fill(RECIPIENT);
		await page.locator("#amount").fill("5");
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(page).toHaveURL(/\/app\/approvals\/\d+$/);
	});

	await test.step("pay two recipients as one batch", async () => {
		await page.goto("/app/pay");
		await page.getByText("Several (batch)", { exact: true }).click();
		await page
			.locator("#batch-asset")
			.selectOption("CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU");
		for (const index of [0, 1]) {
			await page.locator(`#batch-to-${index}`).fill(RECIPIENT);
			await page.locator(`#batch-amount-${index}`).fill("1");
			await page.locator(`#batch-note-${index}`).fill(`Line ${index + 1}`);
		}
		await page.locator("#batch-note").fill("E2E batch");
		await page.getByRole("button", { name: "Request the batch" }).click();
		await expect(page).toHaveURL(/\/app\/approvals\/\d+$/);
		await expect(page.getByText("Line 2").first()).toBeVisible();
	});

	await test.step("ask for money with a link that anyone can open", async () => {
		await page.goto("/app/links");
		await page.locator("#link-amount").fill("12");
		await page.locator("#link-note").fill("E2E membership");
		await page.getByRole("button", { name: "Create link" }).click();
		await expect(page.getByText("Paid 0 of 1")).toBeVisible();
		// The public page needs no ancora pass: it reads the link straight from the contract.
		await page.goto("/app/settings");
		// The first C-address on Settings that isn't one of the accepted tokens.
		const addresses = await page.locator("code").allInnerTexts();
		const organization =
			addresses
				.map((text) => text.trim())
				.find((text) => /^C[A-Z2-7]{55}$/.test(text) && !TOKENS.includes(text)) ?? "";
		// In the report, so a run can be followed on stellar.expert or its link paid from a wallet.
		test.info().annotations.push({
			type: "organization",
			description: `${organization}, payment link 1`,
		});
		const payer = await page.context().newPage();
		await payer.goto(`/pay/${organization}/1`);
		await expect(payer.getByText("E2E membership")).toBeVisible();
		await expect(payer.getByRole("button", { name: "Pay with a Stellar wallet" })).toBeVisible();
		await payer.close();
	});

	await test.step("the payments are found in the activity", async () => {
		await page.goto("/app/activity");
		// The single payment and both lines of the batch went to the same saved recipient.
		await page.locator("#activity-search").fill("Operator");
		await expect(page.getByText("3 movements", { exact: true })).toBeVisible();
		await page.locator("#activity-search").fill("E2E batch");
		await expect(page.getByText("2 movements", { exact: true })).toBeVisible();
	});

	await test.step("the new recipient is in the address book", async () => {
		await page.goto("/app/payees");
		await expect(page.getByText("Operator").first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();
	});

	expect(failures).toEqual([]);
});
