import { useEffect, useState } from "react";
import {
	disablePush,
	enablePush,
	type PushState,
	pushState,
} from "../../adapters/site/pushNotifications.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./NotificationsCard.module.css";

const STATE_TEXT: Record<PushState, string> = {
	on: "On for this device.",
	off: "Off for this device.",
	blocked: "Blocked in this browser's site settings. Allow notifications for ancora there first.",
	unsupported:
		"This browser can't receive notifications. On an iPhone, add ancora to the home screen and open it from there.",
};

/**
 * Notifications on this device: when something waits for your approval, when your request was
 * done or declined, and when a guardian starts recovering your pass. Testnet passes only.
 */
export function NotificationsCard() {
	const { me, dataSource } = useWorkspace();
	const { run, busy } = useCommand();
	const [state, setState] = useState<PushState | null>(null);

	useEffect(() => {
		void pushState().then(setState);
	}, []);

	if (dataSource.kind === "sample") return null;

	const toggle = async () => {
		const result = await run(() => (state === "on" ? disablePush(me.id) : enablePush(me.id)), {
			success: state === "on" ? "Notifications are off." : "Notifications are on.",
		});
		if (result) setState(await pushState());
	};

	return (
		<Card title="Notifications">
			<p className={styles.muted}>
				ancora tells this device when a payment or change waits for your approval, when your request
				went through or was declined, and when a guardian starts recovering your pass.
			</p>
			{state && <p className={styles.state}>{STATE_TEXT[state]}</p>}
			{(state === "on" || state === "off") && (
				<button
					type="button"
					className={buttonClass(state === "on" ? "secondary" : "primary")}
					disabled={busy}
					onClick={() => void toggle()}
				>
					{state === "on" ? "Turn off on this device" : "Turn on for this device"}
				</button>
			)}
		</Card>
	);
}
