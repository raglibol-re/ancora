import { BlobNotFoundError, head, list, put } from "@vercel/blob";

// Which organizations exist, for jobs that must visit every one of them (due standing orders).
// The registry answers "is this an organization?" and "which ones does this person have?", not
// "list them all", so ancora keeps one marker per organization in its Blob store: written when
// the operator deploys one, and when the app opens one that predates the index.

const ROOT = "organizations";
const MARKER = /^organizations\/(C[A-Z2-7]{55})\.json$/;

/** Markers this function instance knows exist; each check would cost a Blob operation. */
const known = new Set<string>();

/**
 * Writes the organization's marker unless it exists: apps announce every organization they
 * open, and a write is the costliest Blob operation, a check the cheapest.
 */
export async function rememberOrganization(contractId: string): Promise<void> {
	if (known.has(contractId)) return;
	try {
		await head(`${ROOT}/${contractId}.json`);
		known.add(contractId);
		return;
	} catch (error) {
		if (!(error instanceof BlobNotFoundError)) throw error;
	}
	await put(`${ROOT}/${contractId}.json`, JSON.stringify({ contractId, seenAt: Date.now() }), {
		access: "public",
		addRandomSuffix: false,
		allowOverwrite: true,
		contentType: "application/json",
	});
	known.add(contractId);
}

/** Every organization the index knows, in no particular order. */
export async function listOrganizations(): Promise<string[]> {
	const ids: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await list({ prefix: `${ROOT}/`, limit: 1000, cursor });
		for (const blob of page.blobs) {
			const id = MARKER.exec(blob.pathname)?.[1];
			if (id) ids.push(id);
		}
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor);
	return ids;
}
