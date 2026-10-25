import type { OrgAccount } from "../../domain/account.ts";
import { isSetupPhase } from "../../domain/rules/governance.ts";
import { evaluateGovernance } from "../../domain/rules/policy.ts";
import { Card } from "../../ui/Card.tsx";
import { Page } from "../../ui/Page.tsx";
import { describeEvaluation } from "../requests/describe.ts";
import { OrgRequired } from "../shell/OrgRequired.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { PeopleCard } from "./PeopleCard.tsx";
import { TemplateCard } from "./TemplateCard.tsx";
import { TiersCard } from "./TiersCard.tsx";

export function RulesPage() {
	return <OrgRequired>{(account) => <Rules account={account} />}</OrgRequired>;
}

function Rules({ account }: { account: OrgAccount }) {
	const { me } = useWorkspace();
	const setup = isSetupPhase(account.org);
	const founder = account.org.founderId === me.id;

	return (
		<Page title="Rules" lead="Who approves what. The account itself enforces these rules.">
			<Card title={setup ? "Setup phase" : "Changing the rules"}>
				<p>
					{setup && founder
						? "Nobody else could approve yet, so you can add people and change the rules directly. Once others can approve, changes need their approval."
						: setup
							? "The founder is still setting up this organization and can make changes directly."
							: `Changes to people and rules are requests too. ${describeEvaluation(account.org, evaluateGovernance(account.org.policy))}`}
				</p>
			</Card>
			{/* Keyed so form state resets when the organization or its rules change. */}
			<TiersCard
				key={`${account.org.id}-${JSON.stringify(account.org.policy)}`}
				account={account}
			/>
			<PeopleCard key={`people-${account.org.id}`} account={account} />
			<TemplateCard key={`template-${account.org.id}`} account={account} />
		</Page>
	);
}
