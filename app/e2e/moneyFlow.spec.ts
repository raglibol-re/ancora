import { expect, test } from "@playwright/test";
import {
	BLEND_USDC,
	createPass,
	foundOrganization,
	RECIPIENT,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// Money that moves on its own terms, on the real Stellar testnet: a standing order whose first
// run pays out at once under the rules, and the Reserve, which lends through a DeFindex vault
// and comes back to the account.

const name = `E2E money ${stamp}`;
/** The standing order's line: "US$1.00 to GC2B…YJE3 every week". */
const ORDER_ROW = /^US\$1\.00 to .+ every week$/;

test("a standing order pays and the Reserve takes money and gives it back", async ({ page }) => {
	test.setTimeout(12 * 60_000);
	await addVirtualPasskey(page);
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));

	await test.step("found an organization and take test money", async () => {
		await createPass(page, name);
		await foundOrganization(page, `${name} club`);
		await takeTestMoney(page, name);
	});

	await test.step("set a weekly standing order; its first run pays at once", async () => {
		await page.goto("/app/pay");
		await page.locator("#asset").selectOption(BLEND_USDC);
		await page.locator("#payee").selectOption("new");
		await page.locator("#payee-name").fill("Coach");
		await page.locator("#payee-account").fill(RECIPIENT);
		await page.locator("#amount").fill("1");
		await page.locator("#repeat").selectOption("week");
		await page.getByRole("button", { name: "Set standing order" }).click();
		// The order and its first run are on the page once the contract call is through.
		await expect(page.getByText(ORDER_ROW)).toBeVisible({ timeout: 120_000 });
		await page.reload();
		await expect(page.getByText(/1 run\b/)).toBeVisible();
	});

	await test.step("stop it", async () => {
		await page.getByRole("button", { name: "Stop" }).click();
		await expect(page.getByText("Standing order stopped.")).toBeVisible();
		await page.reload();
		await expect(page.getByText(ORDER_ROW)).toHaveCount(0);
	});

	await test.step("move money to the Reserve and back", async () => {
		// The vault's shares round down (2 in shows as 1.99), so less comes back out than went in.
		for (const [direction, amount] of [
			["Move in", "2"],
			["Move out", "1"],
		] as const) {
			await page.goto("/app");
			await page.getByRole("button", { name: direction }).first().click();
			await page.locator("#reserve-amount").fill(amount);
			await page.getByRole("button", { name: "Move", exact: true }).click();
			await expect(page.getByText("Done. The balances are updated.")).toBeVisible({
				timeout: 120_000,
			});
		}
	});

	expect(failures).toEqual([]);
});
