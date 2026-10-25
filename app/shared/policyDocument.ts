// The readable form of an organization's rules. Canonical JSON hashed with SHA-256; the
// organization contract stores the hash, so anyone can recompute it from the document and
// verify the active rules. Used by the app and the Functions.
//
// Version 3 follows the canonical-form rules of stellar-registry/perch (CANON v1) so the
// document can later be read by that toolchain: no whitespace, object keys sorted, arrays in
// order, numbers only where they fit in u32, big amounts as decimal strings, no null (absent
// optional fields are left out), no booleans. Version 2 is kept to verify organizations created
// before 26 Oct 2026.

export type PolicyDocumentRequirement = { role: string; count: number };

export type PolicyDocumentV2 = {
	ancora: "policy/2";
	template: string;
	roles: string[];
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

export type PolicyDocumentV3 = {
	ancora: "policy/3";
	template: string;
	/** Highest role first; rank decides who may fill whose approval slot. */
	roles: string[];
	/** Amounts are decimal strings of integer cents of `currency`. */
	unit: "cent";
	currency: string;
	tiers: {
		/** Absent on the last, unbounded tier. */
		upTo?: string;
		approvals: PolicyDocumentRequirement[];
		objectionWindowHours: number;
	}[];
	sealThreshold: string;
	newRecipientApprovals: PolicyDocumentRequirement[];
	budgets: {
		category: string;
		amount: string;
		periodSeconds: number;
		/** "hard" refuses beyond the budget, "soft" escalates to the strictest tier. */
		mode: "hard" | "soft";
	}[];
};

export type PolicyDocument = PolicyDocumentV2 | PolicyDocumentV3;

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
