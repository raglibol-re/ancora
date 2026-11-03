import { Link, useParams } from "react-router";
import { Card } from "../../ui/Card.tsx";
import { formatDateTime } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { DiscussionCard } from "../discussion/DiscussionCard.tsx";
import { describeEvaluation } from "../requests/describe.ts";
import { RequestCard } from "../requests/RequestCard.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { ExpertDetails } from "./ExpertDetails.tsx";

/** Shareable page for one request, found across all of this person's organizations. */
export function RequestDetailPage() {
	const t = useT();
	const { requestId } = useParams();
	const { myAccounts, personName, preferences } = useWorkspace();
	const account = myAccounts.find((a) => a.requests.some((r) => r.id === requestId));
	const request = account?.requests.find((r) => r.id === requestId);

	if (!account || !request) {
		return (
			<Card title={t("Request not found")}>
				<p>{t("This request doesn't exist or belongs to an organization you're not part of.")}</p>
				<Link to="/app/approvals">{t("Back to approvals")}</Link>
			</Card>
		);
	}

	return (
		<Page title={t("Request")}>
			<Link to="/app/approvals">{t("← Approvals")}</Link>
			<RequestCard account={account} request={request} showOrg />
			<Card title={t("Rules for this request")}>
				<p>{describeEvaluation(account.org, request.evaluation)}</p>
				<p>
					{t("The rules were fixed when the request was created on")}{" "}
					{formatDateTime(request.createdAt)}.
				</p>
			</Card>
			{request.approvals.length > 0 && (
				<Card title={t("History")}>
					<ul>
						{request.approvals.map((a) => (
							<li key={a.personId}>
								{t("Approved by")} {personName(a.personId)} · {formatDateTime(a.at)}
							</li>
						))}
					</ul>
				</Card>
			)}
			<DiscussionCard account={account} request={request} />
			{preferences.expertMode && <ExpertDetails account={account} request={request} />}
		</Page>
	);
}
