import { createHash } from "node:crypto";
import { sql } from "./_lib/database.js";
import { apiHandler, RequestError } from "./_lib/http.js";

// Profile pictures and organization logos, addressed by their content hash, in one function
// (Vercel's Hobby plan allows twelve per deployment):
// - POST with the image as the body: stores it and answers with its URL. The URL is then
//   written on-chain (registry profile, organization info) with the owner's passkey. Only the
//   owner can change what an address shows, so the upload itself needs no login: it is a small,
//   public, immutable image.
// - GET ?id=<hash>: the image. The bytes behind a hash never change, so the CDN and browsers
//   keep it for a year and the database is asked once.

const MAX_BYTES = 300 * 1024;
const TYPES: ReadonlySet<string> = new Set(["image/webp", "image/jpeg", "image/png"]);
const HASH = /^[0-9a-f]{64}$/;
const A_YEAR = 365 * 24 * 3600;

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

/** Where the image is served: this deployment's own address, as the browser reached it. */
function imageUrl(request: Request, hash: string): string {
	const host = request.headers.get("x-forwarded-host") ?? new URL(request.url).host;
	return `https://${host}/api/image?id=${hash}`;
}

const upload = apiHandler("POST", async (request) => {
	const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
	if (!TYPES.has(type)) throw new RequestError("Send a WebP, JPEG or PNG image.");
	const bytes = Buffer.from(await request.arrayBuffer());
	if (bytes.length === 0 || bytes.length > MAX_BYTES) {
		throw new RequestError("The picture must be smaller than 300 KB.");
	}
	if (!looksLikeImage(bytes, type)) throw new RequestError("That file isn't a valid image.");
	const hash = createHash("sha256").update(bytes).digest("hex");
	try {
		await sql()`
			insert into images (hash, content_type, data)
			values (${hash}, ${type}, ${bytes.toString("base64")})
			on conflict (hash) do nothing`;
	} catch (error) {
		// The database refused or didn't answer: say so instead of a generic server error.
		console.error(`[image] ${error instanceof Error ? error.message : String(error)}`);
		throw new RequestError(
			"Pictures can't be stored right now: ancora's picture storage is unavailable. Nothing was changed; try again later.",
			503,
		);
	}
	return { url: imageUrl(request, hash) };
});

/** Answers with the image itself, not JSON: browsers load it as a picture from any page. */
async function serve(request: Request): Promise<Response> {
	const id = new URL(request.url).searchParams.get("id") ?? "";
	if (!HASH.test(id)) return new Response("Send the picture's id.", { status: 400 });
	try {
		const [row] = await sql()`select content_type, data from images where hash = ${id}`;
		if (!row) return new Response("No such picture.", { status: 404 });
		return new Response(Buffer.from(String(row.data), "base64"), {
			headers: {
				"Content-Type": String(row.content_type),
				"Cache-Control": `public, max-age=${A_YEAR}, s-maxage=${A_YEAR}, immutable`,
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		console.error(`[image] ${error instanceof Error ? error.message : String(error)}`);
		return new Response("Pictures are unavailable right now.", { status: 503 });
	}
}

export default {
	fetch(request: Request): Promise<Response> {
		return request.method === "GET" ? serve(request) : upload.fetch(request);
	},
};
