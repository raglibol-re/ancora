import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { apiHandler, RequestError } from "./_lib/http.js";

// Profile pictures live in Vercel Blob, addressed by their content hash; the person then stores
// the URL in their on-chain profile with their passkey. Only the owner of an address can change
// what it shows, so the upload itself needs no login: it is a small, public, immutable image.

const MAX_BYTES = 300 * 1024;
const EXTENSIONS: Record<string, string> = {
	"image/webp": "webp",
	"image/jpeg": "jpg",
	"image/png": "png",
};

export const config = { maxDuration: 30 };

/** Checks the first bytes match the declared type, so the store never serves a disguised file. */
export function looksLikeImage(bytes: Uint8Array, type: string): boolean {
	const starts = (...expected: number[]) => expected.every((b, i) => bytes[i] === b);
	switch (type) {
		case "image/png":
			return starts(0x89, 0x50, 0x4e, 0x47);
		case "image/jpeg":
			return starts(0xff, 0xd8, 0xff);
		case "image/webp":
			return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
		default:
			return false;
	}
}

export default apiHandler("POST", async (request) => {
	const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
	const extension = EXTENSIONS[type];
	if (!extension) throw new RequestError("Send a WebP, JPEG or PNG image.");
	const bytes = Buffer.from(await request.arrayBuffer());
	if (bytes.length === 0 || bytes.length > MAX_BYTES) {
		throw new RequestError("The picture must be smaller than 300 KB.");
	}
	if (!looksLikeImage(bytes, type)) throw new RequestError("That file isn't a valid image.");
	const hash = createHash("sha256").update(bytes).digest("hex");
	const blob = await put(`avatars/${hash}.${extension}`, bytes, {
		access: "public",
		contentType: type,
		addRandomSuffix: false,
		allowOverwrite: true,
		cacheControlMaxAge: 365 * 24 * 3600,
	});
	return { url: blob.url };
});
