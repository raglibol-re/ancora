import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const nightBlue = "#0B1730";
const shortcutIcon = { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" };

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: [
				"brand/favicon.svg",
				"brand/mark-on-dark.svg",
				"brand/apple-touch-icon-180.png",
			],
			manifest: {
				id: "/app",
				name: "ancora",
				short_name: "ancora",
				description: "The business account your organization controls.",
				lang: "en",
				dir: "ltr",
				categories: ["finance", "business", "productivity"],
				start_url: "/app",
				scope: "/",
				display: "standalone",
				background_color: nightBlue,
				theme_color: nightBlue,
				// Final brand exports from /design/brand (see its README for the size cuts).
				icons: [
					{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
					{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
					{
						src: "/brand/maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
				// Long-press the installed icon: the three things members open most.
				shortcuts: [
					{ name: "Send money", short_name: "Send", url: "/app/pay", icons: [shortcutIcon] },
					{ name: "Approvals", url: "/app/approvals", icons: [shortcutIcon] },
					{ name: "Activity", url: "/app/activity", icons: [shortcutIcon] },
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,woff2}"],
				// The pot's prover (bb.js, 3.4 MB with its Wasm inline) loads only when it is used.
				globIgnores: ["**/barretenberg*.js"],
				navigateFallback: "/index.html",
				// API routes are server-side and must never be answered from the SPA shell.
				navigateFallbackDenylist: [/^\/api\//],
				// Push notifications: shown by a small hand-written worker next to Workbox's.
				importScripts: ["/push-sw.js"],
			},
		}),
	],
	build: {
		// The lazily loaded testnet chunk carries the Stellar SDK (~1 MB) and the confidential pot's
		// prover (bb.js, 3.4 MB with its Wasm inline) loads on first use; the main bundle stays small.
		chunkSizeWarningLimit: 3500,
	},
	test: {
		include: ["src/**/*.test.ts", "api/**/*.test.ts"],
		// Tests read English whatever the machine's language is.
		setupFiles: ["src/testSetup.ts"],
	},
});
