import { expect, test } from "@playwright/test";
import {
	Account,
	Contract,
	nativeToScVal,
	rpc,
	scValToNative,
	TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
	createPass,
	foundOrganization,
	readAncoraId,
	readOrganizationId,
	requestPayment,
	stamp,
	takeTestMoney,
} from "./steps.ts";
import { addVirtualPasskey } from "./virtualPasskey.ts";

// Private details on the real Stellar testnet: two members set up their devices, the founder
// makes the organization's references private and pays with one; both read it in the app,
// while the reference is stored on Stellar encrypted.

const founderName = `E2E private founder ${stamp}`;
const memberName = `E2E private member ${stamp}`;
const APPLIED = "Done. Applied directly during the setup phase.";
const SECRET = `Coach fee ${stamp}`;
const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";
/** Any funded account works as the source of a read-only simulation. */
const SIMULATION_SOURCE = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";

/** The memo of request `id` exactly as the organization contract stores it. */
async function storedMemo(organization: string, id: number): Promise<string> {
	const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
		fee: "100",
		networkPassphrase: PASSPHRASE,
	})
		.addOperation(new Contract(organization).call("request", nativeToScVal(id, { type: "u64" })))
		.setTimeout(30)
		.build();
	const simulation = await new rpc.Server(RPC_URL).simulateTransaction(tx);
	if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
		throw new Error("Couldn't read the request from the organization contract.");
	}
	const request = scValToNative(simulation.result.retval) as { kind: [string, { memo: string }] };
	return request.kind[1].memo;
}

test("members read a private reference that is stored encrypted", async ({ browser }) => {
	const founder = await (await browser.newContext()).newPage();
	const member = await (await browser.newContext()).newPage();
	await addVirtualPasskey(founder);
	await addVirtualPasskey(member);
	const failures: string[] = [];
	for (const page of [founder, member]) {
		page.on("pageerror", (error) => failures.push(error.message));
	}

	const memberId = await test.step("the member creates a pass", async () => {
		await createPass(member, memberName);
		return readAncoraId(member);
	});

	await test.step("the founder creates the organization and adds the member", async () => {
		await createPass(founder, founderName);
		await foundOrganization(founder, `E2E private ${stamp}`);
		await founder.locator("#invite-person").fill(memberId);
		await founder.locator("#invite-role").selectOption("board");
		await founder.getByRole("button", { name: "Add person" }).click();
		await expect(founder.getByText(APPLIED)).toBeVisible();
	});

	await test.step("the member sets up private details on their device", async () => {
		await member.goto("/app/settings");
		await member.getByRole("button", { name: "Set up this device" }).click();
		await expect(member.getByText("This device is set up.")).toBeVisible();
	});

	await test.step("the founder sets up and makes details private", async () => {
		await founder.goto("/app/settings");
		await founder.getByRole("button", { name: "Set up this device" }).click();
		await expect(founder.getByText("This device is set up.")).toBeVisible();
		await founder.getByRole("button", { name: "Make details private" }).click();
		await expect(founder.getByText("Private from now on.")).toBeVisible();
	});

	const requestUrl = await test.step("the founder pays with a private reference", async () => {
		await takeTestMoney(founder, founderName);
		await requestPayment(founder, "Operator", "5", SECRET);
		await expect(founder.getByText(SECRET).first()).toBeVisible();
		return new URL(founder.url()).pathname;
	});

	await test.step("the member reads it on their own device", async () => {
		await member.goto(requestUrl);
		await expect(member.getByText(SECRET).first()).toBeVisible();
	});

	await test.step("on Stellar the reference is ciphertext", async () => {
		const organization = await readOrganizationId(founder);
		const id = Number(requestUrl.split("/").pop());
		const memo = await storedMemo(organization, id);
		expect(memo.startsWith("enc1:")).toBe(true);
		expect(memo).not.toContain("Coach");
	});

	expect(failures).toEqual([]);
});
