import { expect, type Page } from "@playwright/test";

// Steps several end-to-end flows share. Each is a real testnet transaction; the operator sponsors
// the fees.

/** BlendUSDC on testnet: the one stablecoin whose test money the operator can always hand out. */
export const BLEND_USDC = "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

/** The testnet stablecoins an organization accepts (BlendUSDC, Circle USDC, Circle EURC). */
const TOKENS = [
	BLEND_USDC,
	"CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
	"CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
];

/** The demo operator's account holds a BlendUSDC trustline, so it can receive a test payment. */
export const RECIPIENT = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";

/** Minutes-precise, so names from different runs stay apart in the registry. */
export const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

/** Creates a pass with the page's virtual passkey and waits until its name is on-chain. */
export async function createPass(page: Page, name: string): Promise<void> {
	await page.goto("/app");
	await expect(page.getByRole("heading", { name: "Welcome to ancora" })).toBeVisible();
	await page.getByLabel("Your name").fill(name);
	await page.getByRole("button", { name: "Create my passkey" }).click();
	// The account exists first, the name follows in a second transaction: wait for both.
	await expect(page.getByText(name).first()).toBeVisible();
}

/** The pass's ancora ID as shown on the pass page, without the grouping spaces. */
export async function readAncoraId(page: Page): Promise<string> {
	await page.goto("/app/me");
	const shown =
		(await page.getByLabel("Your ancora pass").locator("code").first().textContent()) ?? "";
	const id = shown.replace(/\s/g, "");
	expect(id).toMatch(/^C[A-Z2-7]{55}$/);
	return id;
}

/** Founds an organization with the default template and lands on its rules. */
export async function foundOrganization(page: Page, name: string): Promise<void> {
	await page.goto("/app/new");
	await page.getByLabel("Name").fill(name);
	await page.getByRole("button", { name: "Create organization" }).click();
	await expect(page).toHaveURL(/\/app\/rules$/);
}

/** Takes the operator's test BlendUSDC into the current organization. */
export async function takeTestMoney(page: Page, passName: string): Promise<void> {
	await page.goto("/app");
	await expect(page.getByText(passName).first()).toBeVisible();
	await page
		.getByRole("button", { name: /BlendUSDC/ })
		.first()
		.click();
	await expect(page.getByRole("dialog", { name: "BlendUSDC" })).toBeVisible();
	await page.getByRole("button", { name: "Add BlendUSDC" }).click();
	await expect(page.getByRole("dialog", { name: "Add BlendUSDC" })).toBeVisible();
	await page.getByRole("button", { name: "Add test BlendUSDC" }).click();
	await expect(page.getByText("Test BlendUSDC arrived on the account.")).toBeVisible();
}

/** Requests a BlendUSDC payment to a new, saved recipient (optionally with a reference). */
export async function requestPayment(
	page: Page,
	payee: string,
	amount: string,
	reference = "",
): Promise<void> {
	await page.goto("/app/pay");
	await page.locator("#asset").selectOption(BLEND_USDC);
	await page.locator("#payee").selectOption("new");
	await page.locator("#payee-name").fill(payee);
	await page.locator("#payee-account").fill(RECIPIENT);
	await page.locator("#amount").fill(amount);
	if (reference) await page.locator("#note").fill(reference);
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/app\/approvals\/\d+$/);
}

/** The open organization's address, as Settings shows it (the first C-address that isn't a token). */
export async function readOrganizationId(page: Page): Promise<string> {
	await page.goto("/app/settings");
	await expect(page.getByText("Account address on Stellar")).toBeVisible();
	const addresses = await page.locator("code").allInnerTexts();
	const organization =
		addresses
			.map((text) => text.trim())
			.find((text) => /^C[A-Z2-7]{55}$/.test(text) && !TOKENS.includes(text)) ?? "";
	expect(organization).toMatch(/^C[A-Z2-7]{55}$/);
	return organization;
}
