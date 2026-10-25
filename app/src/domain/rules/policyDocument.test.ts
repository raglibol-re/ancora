import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "../../../shared/policyDocument.ts";
import { buildPolicyDocument, rulesHash } from "./policyDocument.ts";
import { templates } from "./templates.ts";

describe("canonicalJson", () => {
	it("is independent of key order and whitespace", () => {
		expect(canonicalJson({ b: 1, a: [{ d: null, c: "x" }] })).toBe(
			'{"a":[{"c":"x","d":null}],"b":1}',
		);
		expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
	});
});

describe("policy document", () => {
	it("hashes deterministically and changes with any rule", async () => {
		const { id, roles, policy } = templates.club;
		const first = await rulesHash(id, roles, policy);
		expect(first).toMatch(/^[0-9a-f]{64}$/);
		expect(await rulesHash(id, roles, policy)).toBe(first);
		expect(
			await rulesHash(id, roles, { ...policy, sealThreshold: policy.sealThreshold + 1 }),
		).not.toBe(first);
	});

	it("matches the SHA-256 of the canonical text", async () => {
		const { id, roles, policy } = templates.team;
		const document = buildPolicyDocument(id, roles, policy);
		expect(await rulesHash(id, roles, policy)).toBe(await sha256Hex(canonicalJson(document)));
		expect(document.roles).toEqual(["lead", "member"]);
		expect(document.tiers[2]?.approvals).toEqual([
			{ role: "member", count: 2 },
			{ role: "lead", count: 1 },
		]);
	});
});
