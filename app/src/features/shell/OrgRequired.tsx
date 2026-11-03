import type { ReactNode } from "react";
import { Link } from "react-router";
import type { OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** Renders its child with the active organization, or a prompt to create the first one. */
export function OrgRequired({ children }: { children: (account: OrgAccount) => ReactNode }) {
	const t = useT();
	const { active } = useWorkspace();
	if (active) return children(active);
	return (
		<Card title={t("No organization yet")}>
			<p>{t("Create an organization to get an account, set your rules and invite your people.")}</p>
			<Link to="/app/new" className={buttonClass()}>
				{t("Create organization")}
			</Link>
		</Card>
	);
}
