// Run with `pnpm icons` after changing public/brand/mark.svg; the PNGs are committed.
const nightBlue = { background: "#0B1730" };

export default {
	headLinkOptions: { preset: "2023" },
	preset: {
		transparent: { sizes: [64, 192, 512], favicons: [[48, "favicon.ico"]] },
		maskable: { sizes: [512], padding: 0.15, resizeOptions: nightBlue },
		apple: { sizes: [180], padding: 0.1, resizeOptions: nightBlue },
	},
	images: ["public/brand/mark.svg"],
};
