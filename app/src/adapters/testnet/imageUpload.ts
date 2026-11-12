import { err, ok, type Result } from "../../domain/result.ts";
import { type RuleError, ruleError } from "../../domain/rules/model.ts";

/** Stores a picture in ancora's image store and answers with its public address. */
export async function uploadImage(image: Blob): Promise<Result<string, RuleError>> {
	const response = await fetch("/api/image", {
		method: "POST",
		headers: { "Content-Type": image.type },
		body: image,
	}).catch(() => null);
	const payload = (await response?.json().catch(() => null)) as {
		success?: boolean;
		data?: { url?: string };
		error?: string;
	} | null;
	if (!payload?.success || typeof payload.data?.url !== "string") {
		return err(
			ruleError(
				"not-allowed",
				payload?.error ?? "The picture couldn't be stored right now. Try again shortly.",
			),
		);
	}
	return ok(payload.data.url);
}
