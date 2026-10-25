export type InstallMode =
	/** Already running as an installed app. */
	| "installed"
	/** The browser fired beforeinstallprompt (Chrome/Edge/Android): show an install button. */
	| "prompt"
	/** iOS/iPadOS: no install API, the user adds it via Share → Add to Home Screen. */
	| "ios-manual"
	| "unavailable";

export type InstallEnvironment = {
	userAgent: string;
	maxTouchPoints: number;
	standalone: boolean;
	promptAvailable: boolean;
};

export function detectInstallMode(env: InstallEnvironment): InstallMode {
	if (env.standalone) return "installed";
	if (env.promptAvailable) return "prompt";
	if (isAppleMobile(env)) return "ios-manual";
	return "unavailable";
}

function isAppleMobile({ userAgent, maxTouchPoints }: InstallEnvironment): boolean {
	if (/iPhone|iPad|iPod/.test(userAgent)) return true;
	// iPadOS 13+ reports itself as a Mac; touch support gives it away.
	return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
