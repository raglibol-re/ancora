import { describe, expect, it } from "vitest";
import { availableBalance, type OrgAccount } from "../../domain/account.ts";
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
		const before = accountOf(ds, "tejo-rowing").balance;
		expect((await ds.approve("tejo-rowing", "req-oars", "ines")).ok).toBe(true);
		const after = accountOf(ds, "tejo-rowing");
		expect(after.balance).toBe(before - euros(450));
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
			amount: euros(500),
			note: "Test",
		});
		expect(created.ok).toBe(true);
		const request = accountOf(ds, "mare-labs").requests[0];
		expect(request?.evaluation.approvals).toEqual([{ roleId: "director", count: 1 }]);

		const tooMuch = await ds.requestPayment("meridian-team", "noah", {
			payee: { id: "hw-shop" },
			amount: euros(5_000),
			note: "",
		});
		expect(tooMuch).toMatchObject({ ok: false, error: { code: "insufficient-funds" } });
	});

	it("counts open requests against the available balance", () => {
		const club = accountOf(source(), "tejo-rowing");
		expect(availableBalance(club)).toBe(club.balance - euros(450) - euros(3_200));
	});

	it("lets a founder set up a new organization directly, then requires requests", async () => {
		const ds = source();
		const created = await ds.createOrganization({
			actorId: "ines",
			name: "Book Club",
			templateId: "club",
			founderRoleId: "treasurer",
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
		expect(await ds.moveToReserve("tejo-rowing", "joao", euros(10))).toMatchObject({
			error: { code: "not-allowed" },
		});
		expect((await ds.moveToReserve("tejo-rowing", "ines", euros(1_000))).ok).toBe(true);
		expect(accountOf(ds, "tejo-rowing").reserve).toBe(euros(21_000));
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
		storage.setItem("ancora.sample.v1", "{not json");
		expect(source(storage).getSnapshot().accounts).toHaveLength(3);
	});
});
