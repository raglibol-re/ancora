import { err, ok, type Result } from "../../domain/result.ts";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const SIZE_PX = 256;

/** SVG is refused on purpose: it can carry scripts. */
export function validateLogoFile(file: { type: string; size: number }): Result<true, string> {
	if (!ALLOWED_TYPES.includes(file.type)) {
		return err("Use a PNG, JPG or WebP image. SVG isn't allowed because it can contain scripts.");
	}
	if (file.size > MAX_BYTES) return err("The image is larger than 5 MB. Choose a smaller file.");
	return ok(true);
}

/** Center-crops to a square and re-encodes as a 256×256 WebP data URL, entirely in the browser. */
export async function resizeLogo(file: Blob): Promise<string> {
	const bitmap = await createImageBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const canvas = document.createElement("canvas");
	canvas.width = SIZE_PX;
	canvas.height = SIZE_PX;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("This browser can't process images. Try another browser.");
	context.drawImage(
		bitmap,
		(bitmap.width - side) / 2,
		(bitmap.height - side) / 2,
		side,
		side,
		0,
		0,
		SIZE_PX,
		SIZE_PX,
	);
	bitmap.close();
	return canvas.toDataURL("image/webp", 0.9);
}
