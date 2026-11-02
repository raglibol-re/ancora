import { expect, type Page, test } from "@playwright/test";
import {
	BLEND_USDC,
	createPass,
	foundOrganization,
	readOrganizationId,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// A deal between two organizations on the real Stellar testnet: A proposes a one-milestone deal
// to B, B accepts, A deposits, B asks for the payout, A approves it and the deal completes. Both
// organizations are still in their setup phase, so each founder's step applies directly.

const buyer = `E2E buyer ${stamp}`;
const supplier = `E2E supplier ${stamp}`;

/** Opens the newest deal on this organization's Deals page. */
async function openNewestDeal(page: Page): Promise<void> {
	await page.goto("/app/deals");
	await page
		.getByRole("link", { name: /^Deal #\d+/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/deals\/\d+$/);
}

/** Takes the step whose button matches `name` and waits until it is done. */
async function step(page: Page, name: RegExp): Promise<void> {
	await page.getByRole("button", { name }).click();
	await expect(page.getByText("Done.")).toBeVisible();
	await page.reload();
}

test("two organizations settle a milestone through a deal", async ({ browser }) => {
	const a = await (await browser.newContext()).newPage();
	const b = await (await browser.newContext()).newPage();
	await addVirtualPasskey(a);
	await addVirtualPasskey(b);
	const failures: string[] = [];
	for (const page of [a, b]) page.on("pageerror", (error) => failures.push(error.message));

	const supplierOrg = await test.step("the supplier founds an organization", async () => {
		await createPass(b, supplier);
		await foundOrganization(b, `E2E supplies ${stamp}`);
		return readOrganizationId(b);
	});

	await test.step("the buyer founds an organization and takes test money", async () => {
		await createPass(a, buyer);
		await foundOrganization(a, `E2E buys ${stamp}`);
		await takeTestMoney(a, buyer);
	});

	await test.step("the buyer proposes the deal", async () => {
		await a.goto("/app/deals");
		await a.locator("#deal-party").fill(supplierOrg);
		await a.locator("#deal-asset").selectOption(BLEND_USDC);
		await a.locator("#deal-label-0").fill("Hull");
		await a.locator("#deal-amount-0").fill("5");
		await a.locator("#deal-days").fill("0.001");
		await a.getByLabel("Agreement").setInputFiles({
			name: "agreement.txt",
			mimeType: "text/plain",
			buffer: Buffer.from(`E2E agreement ${stamp}`),
		});
		await a.getByRole("button", { name: "Propose the deal" }).click();
		await expect(a.getByText("Deal proposed.")).toBeVisible();
	});

	await test.step("the supplier accepts the terms", async () => {
		await openNewestDeal(b);
		await expect(b.getByText("Waiting for the other side to accept")).toBeVisible();
		await step(b, /^Accept the terms/);
		await expect(b.getByText("Waiting for the deposit")).toBeVisible();
	});

	await test.step("the buyer deposits the amount", async () => {
		await openNewestDeal(a);
		await step(a, /^Deposit the amount/);
		await expect(a.getByText("Amount deposited")).toBeVisible();
	});

	await test.step("the supplier asks for the payout, the buyer approves it", async () => {
		await openNewestDeal(b);
		await step(b, /^Ask for the payout of "Hull"/);
		await openNewestDeal(a);
		await expect(a.getByText("Payout requested").first()).toBeVisible();
		await step(a, /^Approve the payout of "Hull"/);
		await expect(a.getByText("Completed").first()).toBeVisible();
	});

	expect(failures).toEqual([]);
});
