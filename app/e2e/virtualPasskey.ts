import type { Page } from "@playwright/test";

/**
 * Gives the page a virtual platform authenticator (Chromium's WebAuthn domain): passkeys are
 * created and used without a prompt, as if the person confirmed with Face ID every time.
 * Resident keys let "Sign in with my passkey" find the pass again after signing out.
 */
export async function addVirtualPasskey(page: Page): Promise<void> {
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
		},
	});
}
