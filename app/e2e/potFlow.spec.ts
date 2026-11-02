import { expect, type Page, test } from "@playwright/test";
import {
	createPass,
	foundOrganization,
	readOrganizationId,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// The confidential pot on the real Stellar testnet: two organizations open their pots (keys
// made from a root kept with their private details, a registration proof made in the browser),
// one moves money in and pays the other privately, the other reads the amount and takes it out.
// Both founders act directly during setup.

const aName = `E2E pot payer ${stamp}`;
const bName = `E2E pot payee ${stamp}`;

/** Sets up private details on this device and turns them on (the pot key travels with them). */
async function makeDetailsPrivate(page: Page): Promise<void> {
	await page.goto("/app/settings");
	await page.getByRole("button", { name: "Set up this device" }).click();
	await expect(page.getByText("This device is set up.")).toBeVisible();
	await page.getByRole("button", { name: "Make details private" }).click();
	await expect(page.getByText("Private from now on.")).toBeVisible();
}

async function openPot(page: Page): Promise<void> {
	await page.goto("/app/pot");
	await page.getByRole("button", { name: "Open the pot" }).click();
	await expect(page.getByText("The pot is open.")).toBeVisible({ timeout: 180_000 });
	await page.reload();
	await expect(page.getByText("Spendable in the pot")).toBeVisible();
}

/** Fills one of the pot's forms (named by its heading) and submits it. */
async function potForm(page: Page, form: string, amount: string, to = ""): Promise<void> {
	const scope = page.getByRole("form", { name: form });
	if (to) await scope.getByLabel("Their organization's address").fill(to);
	await scope.getByLabel(/^Amount/).fill(amount);
	await scope.getByRole("button").click();
}

/** The pot's history line that starts with `label`. */
function entry(page: Page, label: string) {
	return page.getByRole("listitem").filter({ hasText: new RegExp(`^${label} ·`) });
}

test("two organizations pay each other from confidential pots", async ({ browser }) => {
	test.setTimeout(15 * 60_000);
	const a = await (await browser.newContext()).newPage();
	const b = await (await browser.newContext()).newPage();
	await addVirtualPasskey(a);
	await addVirtualPasskey(b);
	const failures: string[] = [];
	for (const page of [a, b]) page.on("pageerror", (error) => failures.push(error.message));

	await test.step("the payer founds an organization, takes test money and opens its pot", async () => {
		await createPass(a, aName);
		await foundOrganization(a, `${aName} club`);
		await takeTestMoney(a, aName);
		await makeDetailsPrivate(a);
		await openPot(a);
	});

	const payee = await test.step("the payee opens its pot too", async () => {
		await createPass(b, bName);
		await foundOrganization(b, `${bName} club`);
		await makeDetailsPrivate(b);
		await openPot(b);
		return readOrganizationId(b);
	});

	await test.step("the payer moves 10 in and pays 4 privately", async () => {
		await potForm(a, "Move money in", "10");
		await expect(a.getByText("moved into the pot.")).toBeVisible({ timeout: 120_000 });
		await expect(a.getByText(/\$10\.00 arrived/)).toBeVisible();
		await potForm(a, "Pay another organization", "4", payee);
		await expect(a.getByText("Only your two organizations can read the amount.")).toBeVisible({
			timeout: 240_000,
		});
		await a.reload();
		await expect(a.getByText("$6.00").first()).toBeVisible();
		await expect(entry(a, "Paid")).toContainText("$4.00");
	});

	await test.step("the payee reads the 4 and takes them out", async () => {
		await b.goto("/app/pot");
		await expect(b.getByText(/\$4\.00 arrived/)).toBeVisible();
		await expect(entry(b, "Received")).toContainText("$4.00");
		await potForm(b, "Take money out", "4");
		await expect(b.getByText("taken out of the pot.")).toBeVisible({ timeout: 240_000 });
		await b.reload();
		await expect(entry(b, "Taken out")).toContainText("$4.00");
	});

	expect(failures).toEqual([]);
});
