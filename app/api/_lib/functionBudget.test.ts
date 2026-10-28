import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vercel's Hobby plan refuses a deployment with more than twelve functions, after the build has
// passed (26–28 Oct 2026: two new routes silently kept production on an old build for two
// days). Every file under api/ outside _lib and tests becomes a function.
const LIMIT = 12;

function functions(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name.startsWith("_") ? [] : functions(path);
		return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe("API function budget", () => {
	it(`stays within Vercel Hobby's ${LIMIT} functions per deployment`, () => {
		expect(functions("api").length).toBeLessThanOrEqual(LIMIT);
	});
});
