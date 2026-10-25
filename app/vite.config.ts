import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const nightBlue = "#0B1730";

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
				name: "ancora",
				short_name: "ancora",
				description: "The finance account for your organization.",
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
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,woff2}"],
				navigateFallback: "/index.html",
				// API routes are server-side and must never be answered from the SPA shell.
				navigateFallbackDenylist: [/^\/api\//],
			},
		}),
	],
	build: {
		// The lazily loaded testnet chunk carries the Stellar SDK (~1 MB); the main bundle stays small.
		chunkSizeWarningLimit: 1500,
	},
	test: {
		include: ["src/**/*.test.ts", "api/**/*.test.ts"],
	},
});
