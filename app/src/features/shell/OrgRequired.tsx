import type { ReactNode } from "react";
import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** Renders its child with the active organization, or a prompt to create the first one. */
export function OrgRequired({ children }: { children: (account: OrgAccount) => ReactNode }) {
	const { active } = useWorkspace();
	if (active) return children(active);
	return (
		<Card title="No organization yet">
			<p>Create an organization to get an account, set your rules and invite your people.</p>
			<Link to="/app/new" className={buttonClass()}>
				Create organization
			</Link>
		</Card>
	);
}
