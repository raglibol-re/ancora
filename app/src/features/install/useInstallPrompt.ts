import { useCallback, useEffect, useState } from "react";
import { detectInstallMode, type InstallMode } from "./installMode.ts";

/** Chromium-only event; not part of lib.dom yet. */
type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
	window.matchMedia("(display-mode: standalone)").matches ||
	("standalone" in navigator && navigator.standalone === true);

export function useInstallPrompt(): { mode: InstallMode; install: () => Promise<void> } {
	const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
	const [installed, setInstalled] = useState(isStandalone);

	useEffect(() => {
		const capturePrompt = (event: Event) => {
			// Keep the browser's mini-infobar from showing; we offer our own button.
			event.preventDefault();
			setPromptEvent(event as BeforeInstallPromptEvent);
		};
		const markInstalled = () => setInstalled(true);
		window.addEventListener("beforeinstallprompt", capturePrompt);
		window.addEventListener("appinstalled", markInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", capturePrompt);
			window.removeEventListener("appinstalled", markInstalled);
		};
	}, []);

	const install = useCallback(async () => {
		if (!promptEvent) return;
		await promptEvent.prompt();
		const { outcome } = await promptEvent.userChoice;
		setPromptEvent(null);
		if (outcome === "accepted") setInstalled(true);
	}, [promptEvent]);

	const mode = detectInstallMode({
		userAgent: navigator.userAgent,
		maxTouchPoints: navigator.maxTouchPoints,
		standalone: installed,
		promptAvailable: promptEvent !== null,
	});

	return { mode, install };
}
