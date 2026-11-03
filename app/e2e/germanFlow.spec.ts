import { expect, test } from "@playwright/test";
import { BLEND_USDC, RECIPIENT, stamp } from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// A German-speaking browser gets ancora in German, on the real Stellar testnet: the pass, a new
// organization, test money and a payment, with the engine's texts (request title, status) in
// German too; the language switch then turns everything back to English.

test.use({ locale: "de-DE" });

const name = `E2E DE ${stamp}`;

test("ancora speaks German from the first screen to the first payment", async ({ page }) => {
	await addVirtualPasskey(page);
	const failures: string[] = [];
	let request = "";
	page.on("pageerror", (error) => failures.push(error.message));

	await test.step("the landing page follows the browser's language", async () => {
		await page.goto("/");
		await expect(page.locator("html")).toHaveAttribute("lang", "de");
		await expect(page).toHaveTitle(/ancora/);
		await expect(page.getByRole("link", { name: "Anmelden" }).first()).toBeVisible();
	});

	await test.step("create a pass", async () => {
		await page.goto("/app");
		await expect(page.getByRole("heading", { name: "Willkommen bei ancora" })).toBeVisible();
		await page.getByLabel("Ihr Name").fill(name);
		await page.getByRole("button", { name: "Meinen Passkey erstellen" }).click();
		await expect(page.getByText(name).first()).toBeVisible();
	});

	await test.step("found an organization", async () => {
		await page.goto("/app/new");
		await page.getByLabel("Name").fill(`E2E Verein ${stamp}`);
		await page.getByRole("button", { name: "Organisation gründen" }).click();
		await expect(page).toHaveURL(/\/app\/rules$/);
		// The default template's roles carry German names.
		await expect(page.getByText("Kassenwart").first()).toBeVisible();
	});

	await test.step("take test money", async () => {
		await page.goto("/app");
		await page
			.getByRole("button", { name: /BlendUSDC/ })
			.first()
			.click();
		await page.getByRole("button", { name: "BlendUSDC hinzufügen" }).click();
		await page.getByRole("button", { name: "Test-BlendUSDC hinzufügen" }).click();
		await expect(page.getByText("Test-BlendUSDC ist auf dem Konto angekommen.")).toBeVisible();
	});

	await test.step("pay someone, with the request in German", async () => {
		await page.goto("/app/pay");
		await page.locator("#asset").selectOption(BLEND_USDC);
		await page.locator("#payee").selectOption("new");
		await page.locator("#payee-name").fill("Operator");
		await page.locator("#payee-account").fill(RECIPIENT);
		// German decimal comma.
		await page.locator("#amount").fill("2,50");
		await page.getByRole("button", { name: "Weiter" }).click();
		// The payment is signed and sent before the page moves on; testnet can be slow.
		await expect(page).toHaveURL(/\/app\/approvals\/\d+$/, { timeout: 180_000 });
		request = page.url();
		await expect(page.getByText(/2,50.* an Operator/).first()).toBeVisible();
		await expect(page.getByText(/ to Operator/)).toHaveCount(0);
	});

	await test.step("the language switch turns everything back to English", async () => {
		await page.getByText("English", { exact: true }).first().click();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await page.goto(request);
		await expect(page.getByText(/2\.50.* to Operator/).first()).toBeVisible();
	});

	expect(failures).toEqual([]);
});
