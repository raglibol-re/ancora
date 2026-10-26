import { describe, expect, it } from "vitest";
import { availableBalance, balanceOf, type OrgAccount } from "../../domain/account.ts";
import { inboxFor } from "../../domain/inbox.ts";
import { euros } from "../../domain/money.ts";
import { SampleDataSource } from "./sampleDataSource.ts";

const NOW = Date.UTC(2026, 9, 25, 12);

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
	};
}

function source(storage = memoryStorage()) {
	let counter = 0;
	return new SampleDataSource(
		storage,
		() => NOW,
		() => `id-${++counter}`,
	);
}

const accountOf = (ds: SampleDataSource, orgId: string): OrgAccount => {
	const account = ds.getSnapshot().accounts.find((a) => a.org.id === orgId);
	if (!account) throw new Error(`No account ${orgId}`);
	return account;
};

describe("SampleDataSource", () => {
	it("shows each person only what they can still approve, across organizations", () => {
		const ds = source();
		const inbox = inboxFor(ds.getSnapshot(), "ines").map((item) => item.request.id);
		// Club oars (needs a board member, treasurer qualifies) and both company payments.
		// Not the team hardware request: Inês is only a member there and it needs the lead.
		expect(inbox.sort()).toEqual(["req-design", "req-hosting", "req-oars"]);
	});

	it("executes a payment once approved and updates balance and history", async () => {
		const ds = source();
		const before = balanceOf(accountOf(ds, "tejo-rowing"), "eurc").balance;
		expect((await ds.approve("tejo-rowing", "req-oars", "ines")).ok).toBe(true);
		const after = accountOf(ds, "tejo-rowing");
		expect(balanceOf(after, "eurc").balance).toBe(before - euros(450));
		expect(after.requests.find((r) => r.id === "req-oars")?.status).toBe("executed");
		expect(after.activity[0]).toMatchObject({ kind: "payment-out", payeeId: "boat-supplies" });
	});

	it("needs both approvals and the seal for a large payment", async () => {
		const ds = source();
		await ds.approve("mare-labs", "req-design", "ines");
		expect(accountOf(ds, "mare-labs").requests.find((r) => r.id === "req-design")?.status).toBe(
			"pending",
		);
		await ds.seal("mare-labs", "req-design", "ines");
		expect(accountOf(ds, "mare-labs").requests.find((r) => r.id === "req-design")?.status).toBe(
			"executed",
		);
	});

	it("creates payment requests with the new-recipient rule and refuses overdrafts", async () => {
		const ds = source();
		const created = await ds.requestPayment("mare-labs", "rui", {
			payee: { name: "New Vendor", account: "PT50 1" },
			token: "eurc",
			amount: euros(500),
			note: "Test",
		});
		expect(created.ok).toBe(true);
		const request = accountOf(ds, "mare-labs").requests[0];
		expect(request?.evaluation.approvals).toEqual([{ roleId: "director", count: 1 }]);

		const tooMuch = await ds.requestPayment("meridian-team", "noah", {
			payee: { id: "hw-shop" },
			token: "eurc",
			amount: euros(5_000),
			note: "",
		});
		expect(tooMuch).toMatchObject({ ok: false, error: { code: "insufficient-funds" } });
	});

	it("pays in a second asset, applying the strictest tier for another currency", async () => {
		const ds = source();
		const created = await ds.requestPayment("tejo-rowing", "ines", {
			payee: { id: "boat-supplies" },
			token: "usdc",
			amount: euros(50),
			note: "Dollar invoice",
		});
		expect(created.ok).toBe(true);
		const request = accountOf(ds, "tejo-rowing").requests[0];
		expect(request).toMatchObject({
			kind: "payment",
			currency: "USD",
			status: "pending",
			evaluation: { tierIndex: 2, sealRequired: true },
		});
		expect(availableBalance(accountOf(ds, "tejo-rowing"), "usdc")).toBe(euros(1_250) - euros(50));
	});

	it("adds and drops accepted assets through governance, never one in use", async () => {
		const ds = source();
		const created = await ds.createOrganization({
			actorId: "ines",
			name: "Chess Club",
			templateId: "club",
			founderRoleId: "treasurer",
			baseCurrency: "EUR",
			assets: ["eurc"],
		});
		if (!created.ok) throw new Error(created.error.message);
		const orgId = created.value;
		expect(accountOf(ds, orgId).org.assets.map((a) => a.token)).toEqual(["eurc"]);
		expect(
			await ds.proposeChange(orgId, "ines", { type: "removeAsset", token: "eurc" }),
		).toMatchObject({ error: { code: "last-asset" } });
		expect(
			await ds.proposeChange(orgId, "ines", {
				type: "addAsset",
				asset: { token: "usdc", symbol: "USDC", currency: "USD" },
			}),
		).toEqual({ ok: true, value: "applied" });
		expect(
			accountOf(ds, orgId)
				.balances.map((b) => b.token)
				.sort(),
		).toEqual(["eurc", "usdc"]);
		expect((await ds.addTestMoney(orgId, "ines", "usdc")).ok).toBe(true);
		expect(
			await ds.proposeChange(orgId, "ines", { type: "removeAsset", token: "usdc" }),
		).toMatchObject({ error: { code: "asset-in-use" } });
		expect(await ds.proposeChange(orgId, "ines", { type: "removeAsset", token: "eurc" })).toEqual({
			ok: true,
			value: "applied",
		});
		expect(accountOf(ds, orgId).balances.map((b) => b.token)).toEqual(["usdc"]);
	});

	it("counts open requests against the available balance", () => {
		const club = accountOf(source(), "tejo-rowing");
		// Pending, scheduled and held (secure handover) payments are all set aside.
		expect(availableBalance(club, "eurc")).toBe(
			balanceOf(club, "eurc").balance - euros(450) - euros(3_200) - euros(1_200),
		);
	});

	it("lets a founder set up a new organization directly, then requires requests", async () => {
		const ds = source();
		const created = await ds.createOrganization({
			actorId: "ines",
			name: "Book Club",
			templateId: "club",
			founderRoleId: "treasurer",
			baseCurrency: "EUR",
			assets: ["eurc", "usdc"],
		});
		if (!created.ok) throw new Error(created.error.message);
		const orgId = created.value;
		for (const personId of ["tomas", "marta"]) {
			const outcome = await ds.proposeChange(orgId, "ines", {
				type: "addMember",
				personId,
				roleId: "board",
			});
			expect(outcome).toEqual({ ok: true, value: "applied" });
		}
		const requested = await ds.proposeChange(orgId, "ines", {
			type: "addMember",
			personId: "joao",
			roleId: "member",
		});
		expect(requested).toEqual({ ok: true, value: "requested" });
		expect(accountOf(ds, orgId).requests[0]?.kind).toBe("governance");
	});

	it("only lets approvers move money to the Reserve", async () => {
		const ds = source();
		expect(await ds.moveToReserve("tejo-rowing", "joao", "eurc", euros(10))).toMatchObject({
			error: { code: "not-allowed" },
		});
		expect((await ds.moveToReserve("tejo-rowing", "ines", "eurc", euros(1_000))).ok).toBe(true);
		expect(balanceOf(accountOf(ds, "tejo-rowing"), "eurc").reserve).toBe(euros(21_000));
	});

	it("keeps a discussion per request: members post, others react, the requester answers", async () => {
		const ds = source();
		expect(
			await ds.discussions.post("tejo-rowing", "req-oars", "noah", { kind: "pro", text: "x" }),
		).toMatchObject({ error: { code: "not-allowed" } });
		expect(
			(
				await ds.discussions.post("tejo-rowing", "req-oars", "marta", {
					kind: "question",
					text: "Do we need two pairs?",
				})
			).ok,
		).toBe(true);
		const posted = accountOf(ds, "tejo-rowing").discussions["req-oars"]?.[0];
		if (!posted) throw new Error("no entry");
		expect(posted).toMatchObject({ kind: "question", authorId: "marta", answered: false });
		expect(
			await ds.discussions.react("tejo-rowing", "req-oars", posted.id, "marta", "up"),
		).toMatchObject({ error: { code: "not-allowed" } });
		expect(
			(await ds.discussions.react("tejo-rowing", "req-oars", posted.id, "tomas", "up")).ok,
		).toBe(true);
		expect(
			await ds.discussions.markAnswered("tejo-rowing", "req-oars", posted.id, "tomas"),
		).toMatchObject({ error: { code: "not-allowed" } });
		expect(
			(await ds.discussions.markAnswered("tejo-rowing", "req-oars", posted.id, "joao")).ok,
		).toBe(true);
		expect(accountOf(ds, "tejo-rowing").discussions["req-oars"]?.[0]).toMatchObject({
			answered: true,
			reactions: { tomas: "up" },
		});
	});

	it("lets a member with a spending limit pay inside it without approvals, and books it", async () => {
		const ds = source();
		const inside = await ds.requestPayment("tejo-rowing", "joao", {
			payee: { id: "boat-supplies" },
			token: "eurc",
			amount: euros(300),
			note: "Rope",
		});
		expect(inside.ok).toBe(true);
		const account = accountOf(ds, "tejo-rowing");
		expect(account.requests[0]).toMatchObject({
			status: "executed",
			evaluation: { withinLimit: true },
		});
		expect(account.org.members.find((m) => m.personId === "joao")?.limit?.spent).toBe(euros(360));
		const beyond = await ds.requestPayment("tejo-rowing", "joao", {
			payee: { id: "boat-supplies" },
			token: "eurc",
			amount: euros(300),
			note: "Too much for the allowance",
		});
		expect(beyond.ok).toBe(true);
		expect(accountOf(ds, "tejo-rowing").requests[0]).toMatchObject({ status: "pending" });
	});

	it("persists to storage and survives a reload", async () => {
		const storage = memoryStorage();
		const first = source(storage);
		await first.approve("tejo-rowing", "req-oars", "ines");
		const reloaded = source(storage);
		expect(
			accountOf(reloaded, "tejo-rowing").requests.find((r) => r.id === "req-oars")?.status,
		).toBe("executed");
	});

	it("falls back to the seed when stored data is corrupt", () => {
		const storage = memoryStorage();
		storage.setItem("ancora.sample.v8", "{not json");
		expect(source(storage).getSnapshot().accounts).toHaveLength(3);
	});
});
