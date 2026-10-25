// The readable form of an organization's rules. Canonical JSON (sorted keys, no whitespace,
// integers only) hashed with SHA-256; the organization contract stores the hash, so anyone can
// recompute it from the document and verify the active rules. Used by the app and the Functions.

export type PolicyDocumentRequirement = { role: string; count: number };

export type PolicyDocument = {
	ancora: "policy/2";
	template: string;
	/** Highest role first; rank decides who may fill whose approval slot. */
	roles: string[];
	/** Amounts are integer cents of `currency`; other currencies take the strictest tier. */
	unit: "cent";
	currency: string;
	tiers: {
		upTo: number | null;
		approvals: PolicyDocumentRequirement[];
		objectionWindowHours: number;
	}[];
	sealThreshold: number;
	newRecipientApprovals: PolicyDocumentRequirement[];
};

/** Deterministic JSON: object keys sorted, arrays in order, no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const record = value as Record<string, unknown>;
	const body = Object.keys(record)
		.sort()
		.filter((key) => record[key] !== undefined)
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
	return `{${body.join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function policyDocumentHash(document: PolicyDocument): Promise<string> {
	return sha256Hex(canonicalJson(document));
}
