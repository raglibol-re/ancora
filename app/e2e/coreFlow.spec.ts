import { expect, test } from "@playwright/test";
import {
	BLEND_USDC,
	createPass,
	foundOrganization,
	RECIPIENT,
	readOrganizationId,
	requestPayment,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// The core path a new organization takes, on the real Stellar testnet: create a pass, sign out
// and back in on the same device (the wallet index), found an organization, take test money,
// pay someone. Every step is a real transaction; the operator sponsors the fees.

const name = `E2E ${stamp}`;

test("a new organization goes from passkey to first payment", async ({ page }) => {
	await addVirtualPasskey(page);
	// No step may end in a message that something failed.
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));

	await test.step("create a pass", () => createPass(page, name));

	await test.step("sign out and back in with the same passkey", async () => {
		await page.goto("/app/me");
		await page.getByRole("button", { name: "Sign out" }).click();
		await expect(page.getByRole("heading", { name: "Welcome to ancora" })).toBeVisible();
		await page.getByRole("button", { name: "Sign in with my passkey" }).click();
		// The same pass, with its name read back from the registry.
		await expect(page.getByText(name).first()).toBeVisible();
		await expect(page.getByRole("alert")).toHaveCount(0);
	});

	await test.step("found an organization", () => foundOrganization(page, `E2E club ${stamp}`));

	await test.step("add a role of the organization's own", async () => {
		// Still the setup phase: the founder's change applies directly, on-chain.
		await page.locator("#role-name").fill("Coach");
		await page.getByRole("button", { name: "Add role" }).click();
		await page.getByRole("button", { name: "Save roles" }).click();
		await expect(page.getByRole("button", { name: "Save roles" })).toBeHidden();
		await page.reload();
		await expect(page.getByRole("button", { name: "Remove Coach" })).toBeVisible();
	});

	await test.step("take test money", () => takeTestMoney(page, name));

	await test.step("pay someone", () => requestPayment(page, "Operator", "5"));

	await test.step("pay two recipients as one batch", async () => {
		await page.goto("/app/pay");
		await page.getByText("Several (batch)", { exact: true }).click();
		await page.locator("#batch-asset").selectOption(BLEND_USDC);
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

	await test.step("fill a batch from a spreadsheet export", async () => {
		await page.goto("/app/pay");
		await page.getByText("Several (batch)", { exact: true }).click();
		// A European export: semicolons, decimal commas, a header, a saved payee by name.
		const csv = `Recipient;Amount;Reference
Operator;2,50;Kit
${RECIPIENT};1;Fees
`;
		await page.getByLabel("Import from a spreadsheet (CSV)").setInputFiles({
			name: "payroll.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(csv),
		});
		await expect(page.locator("#batch-to-0")).toHaveValue(RECIPIENT);
		await expect(page.locator("#batch-amount-0")).toHaveValue("2,50");
		await expect(page.locator("#batch-note-1")).toHaveValue("Fees");
		await expect(page.getByText(/to 2 recipients/)).toContainText("3.50");
	});

	await test.step("ask for money with a link that anyone can open", async () => {
		await page.goto("/app/links");
		await page.locator("#link-amount").fill("12");
		await page.locator("#link-note").fill("E2E membership");
		await page.getByRole("button", { name: "Create link" }).click();
		await expect(page.getByText("Paid 0 of 1")).toBeVisible();
		// The public page needs no ancora pass: it reads the link straight from the contract.
		const organization = await readOrganizationId(page);
		// A new organization runs the latest ancora-organization release on the Stellar Registry.
		await expect(page.getByText(/ancora release [\d.]+, the latest/)).toBeVisible();
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
