import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const nightBlue = "#0B1730";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["brand/favicon.ico", "brand/apple-touch-icon-180x180.png", "brand/mark.svg"],
			manifest: {
				name: "ancora",
				short_name: "ancora",
				description: "The finance account for your organization.",
				start_url: "/app",
				scope: "/",
				display: "standalone",
				background_color: nightBlue,
				theme_color: nightBlue,
				icons: [
					{ src: "/brand/pwa-64x64.png", sizes: "64x64", type: "image/png" },
					{ src: "/brand/pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{ src: "/brand/pwa-512x512.png", sizes: "512x512", type: "image/png" },
					{
						src: "/brand/maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
				navigateFallback: "/index.html",
				// API routes are server-side and must never be answered from the SPA shell.
				navigateFallbackDenylist: [/^\/api\//],
			},
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
	},
});
