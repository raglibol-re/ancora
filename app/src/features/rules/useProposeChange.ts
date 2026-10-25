import type { OrgAccount } from "../../domain/account.ts";
import type { GovernanceChange } from "../../domain/rules/governance.ts";
import { describeChange } from "../requests/describe.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** Membership and rule changes: direct during the setup phase, otherwise an approval request. */
export function useProposeChange(account: OrgAccount) {
	const { dataSource, me, personName } = useWorkspace();
	const { run, busy } = useCommand();

	const propose = (change: GovernanceChange) =>
		run(() => dataSource.proposeChange(account.org.id, me.id, change), {
			signature: { kind: "passkey", title: describeChange(account.org, change, personName) },
			success: (outcome) =>
				outcome === "applied"
					? "Done. Applied directly during the setup phase."
					: "Change requested. It takes effect once approved.",
		});

	return { propose, busy };
}
