import { describe, expect, it } from "vitest";
import type { OrgAccount } from "./account.ts";
import { pendingPotSpend } from "./pot.ts";

const account = (requests: unknown[]) => ({ requests }) as unknown as OrgAccount;
const pot = (type: string, status: string) => ({
	kind: "pot",
	status,
	action: type === "pay" ? { type, to: "C", sealed: "" } : { type, amount: 1 },
});

describe("a pending pot spend", () => {
	it("is a payment or withdrawal not yet run", () => {
		expect(pendingPotSpend(account([pot("pay", "pending")]))).not.toBeNull();
		expect(pendingPotSpend(account([pot("withdraw", "scheduled")]))).not.toBeNull();
	});

	it("isn't a deposit, an opening, or a spend that ran or was declined", () => {
		expect(pendingPotSpend(account([pot("deposit", "pending")]))).toBeNull();
		expect(pendingPotSpend(account([pot("register", "pending")]))).toBeNull();
		expect(pendingPotSpend(account([pot("pay", "executed"), pot("pay", "declined")]))).toBeNull();
	});
});
