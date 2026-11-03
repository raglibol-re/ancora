import { WAIT_OPTIONS } from "../../domain/lifeline.ts";
import { t } from "../../ui/i18n.ts";

/** A plan's waiting period: "7 days", "2 minutes". */
export function describeWait(seconds: number): string {
	const option = WAIT_OPTIONS.find((o) => o.seconds === seconds);
	if (option) return t(option.label.replace(" (demo)", ""));
	if (seconds % 86_400 === 0) return t("{count} days", { count: seconds / 86_400 });
	if (seconds % 3_600 === 0) return t("{count} hours", { count: seconds / 3_600 });
	return t("{count} minutes", { count: Math.round(seconds / 60) });
}

/** "in 1 h 58 min", "in 3 days", "now". */
export function describeTimeLeft(ms: number): string {
	if (ms <= 0) return t("now");
	const minutes = Math.ceil(ms / 60_000);
	if (minutes < 60) return t("in {minutes} min", { minutes });
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return t("in {hours} h {minutes} min", { hours, minutes: minutes % 60 });
	return t("in {days} days", { days: Math.ceil(hours / 24) });
}
