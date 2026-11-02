import type { Page } from "@playwright/test";

/**
 * Pins the page to the testnet and gives it a virtual platform authenticator (Chromium's
 * WebAuthn domain): passkeys are created and used without a prompt, as if the person confirmed
 * with Face ID every time.
 * Resident keys let "Sign in with my passkey" find the pass again after signing out.
 */
export async function addVirtualPasskey(page: Page): Promise<void> {
	await preferTestnet(page);
	const session = await page.context().newCDPSession(page);
	await session.send("WebAuthn.enable");
	await session.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
			// PRF, so device keys are made from the passkey as on phones that sync passkeys.
			hasPrf: true,
		},
	});
}

/**
 * Pins this browser to the Stellar testnet (your pass → Network & data), so the tests don't
 * depend on the site-wide default the demo admin sets. Other saved preferences are kept.
 */
async function preferTestnet(page: Page): Promise<void> {
	await page.addInitScript(
		`const saved = JSON.parse(localStorage.getItem("ancora.prefs.v1") ?? "{}");
		localStorage.setItem("ancora.prefs.v1", JSON.stringify({ ...saved, dataSource: "testnet" }));`,
	);
}
