import { inboxFor } from "../../domain/inbox.ts";
import { Card } from "../../ui/Card.tsx";
import { Page } from "../../ui/Page.tsx";
import { RequestCard } from "../requests/RequestCard.tsx";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";

/** Everything this person can still approve, across all their organizations. */
export function InboxPage() {
	const { workspace, me } = useWorkspace();
	const items = inboxFor(workspace, me.id);

	return (
		<Page
			title="Inbox"
			lead="Requests across all your organizations that are waiting for your approval."
		>
			{items.length === 0 ? (
				<Card>
					<p>You're all caught up. Nothing is waiting for you.</p>
				</Card>
			) : (
				items.map((item) => (
					<RequestCard
						key={item.request.id}
						account={item.account}
						request={item.request}
						showOrg
					/>
				))
			)}
		</Page>
	);
}
