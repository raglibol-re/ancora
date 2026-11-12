// Due standing orders run when the organization is opened: the contract lets anyone run them
// and the operator pays the fee. A run can fail for a moment (the RPC, a page reload in
// between), so it is tried again with a later refresh, a few times; a refusal by the rules
// doesn't change, so not forever.

export type DueOrder = { orgId: string; id: string };

/** A due standing order is tried this often per visit. */
export const ORDER_ATTEMPTS = 3;

export class DueOrderRuns {
	private readonly attempts = new Map<string, number>();
	private running = false;

	/** Whether the order still has attempts left this visit. */
	canTry(order: DueOrder): boolean {
		return (this.attempts.get(keyOf(order)) ?? 0) < ORDER_ATTEMPTS;
	}

	/**
	 * Runs the orders that still have attempts left, one after the other. Does nothing while an
	 * earlier call is still running, so two refreshes never run an order twice. Resolves to
	 * whether at least one ran, which is when the chain has something new to read.
	 */
	async run(
		due: readonly DueOrder[],
		runOne: (order: DueOrder) => Promise<{ ok: true } | { ok: false; message: string }>,
		onFailure: (message: string) => void,
	): Promise<boolean> {
		if (this.running) return false;
		this.running = true;
		let ran = false;
		try {
			for (const order of due) {
				if (!this.canTry(order)) continue;
				this.attempts.set(keyOf(order), (this.attempts.get(keyOf(order)) ?? 0) + 1);
				const result = await runOne(order);
				if (result.ok) ran = true;
				else onFailure(result.message);
			}
		} finally {
			this.running = false;
		}
		return ran;
	}
}

const keyOf = (order: DueOrder) => `${order.orgId}:${order.id}`;
