import { defineConfig } from "@playwright/test";

// End-to-end tests against a deployed ancora on the Stellar testnet (the API functions don't run
// under `vite preview`). Signed flows use Chromium's virtual WebAuthn authenticator, so no real
// device is involved. Locally the installed Edge is used; CI installs Chromium.

export default defineConfig({
	testDir: "./e2e",
	// One flow builds on the previous step (pass → organization → money → payment).
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 6 * 60_000,
	expect: { timeout: 90_000 },
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: process.env.E2E_BASE_URL ?? "https://ancora-gray.vercel.app",
		channel: process.env.E2E_CHANNEL ?? (process.env.CI ? undefined : "msedge"),
		headless: true,
		viewport: { width: 1280, height: 800 },
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
});
