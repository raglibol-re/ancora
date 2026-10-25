import { describe, expect, it } from "vitest";
import { detectInstallMode, type InstallEnvironment } from "./installMode.ts";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const ipadOs = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0";

const env = (overrides: Partial<InstallEnvironment>): InstallEnvironment => ({
	userAgent: android,
	maxTouchPoints: 5,
	standalone: false,
	promptAvailable: false,
	...overrides,
});

describe("detectInstallMode", () => {
	it("reports installed when running standalone, even if a prompt is available", () => {
		expect(detectInstallMode(env({ standalone: true, promptAvailable: true }))).toBe("installed");
	});

	it("offers the native prompt when the browser provides one", () => {
		expect(detectInstallMode(env({ promptAvailable: true }))).toBe("prompt");
	});

	it("shows the manual hint on iPhone", () => {
		expect(detectInstallMode(env({ userAgent: iphone }))).toBe("ios-manual");
	});

	it("recognises iPadOS by touch support despite its desktop user agent", () => {
		expect(detectInstallMode(env({ userAgent: ipadOs, maxTouchPoints: 5 }))).toBe("ios-manual");
		expect(detectInstallMode(env({ userAgent: ipadOs, maxTouchPoints: 0 }))).toBe("unavailable");
	});

	it("is unavailable on Android before the prompt fires", () => {
		expect(detectInstallMode(env({}))).toBe("unavailable");
	});
});
