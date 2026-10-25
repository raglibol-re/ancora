import { useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { RequestStatus } from "../../domain/rules/requests.ts";
import { Card } from "../../ui/Card.tsx";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { RequestCard } from "../requests/RequestCard.tsx";
import { OrgRequired } from "../shell/OrgRequired.tsx";

type Filter = "open" | "scheduled" | "done";

const statusesFor: Readonly<Record<Filter, readonly RequestStatus[]>> = {
	open: ["pending", "ready"],
	scheduled: ["scheduled"],
	done: ["executed", "declined", "failed"],
};

export function ApprovalsPage() {
	return <OrgRequired>{(account) => <Approvals account={account} />}</OrgRequired>;
}

function Approvals({ account }: { account: OrgAccount }) {
	const [filter, setFilter] = useState<Filter>("open");
	const count = (f: Filter) =>
		account.requests.filter((r) => statusesFor[f].includes(r.status)).length;
	const shown = account.requests.filter((r) => statusesFor[filter].includes(r.status));

	return (
		<Page title="Approvals" lead={`Payments and changes in ${account.org.name}.`}>
			<Segmented
				label="Show requests"
				value={filter}
				onChange={setFilter}
				options={[
					{ value: "open", label: "Open", count: count("open") },
					{ value: "scheduled", label: "Objection window", count: count("scheduled") },
					{ value: "done", label: "Done", count: count("done") },
				]}
			/>
			{shown.length === 0 ? (
				<Card>
					<p>No requests here.</p>
				</Card>
			) : (
				shown.map((request) => <RequestCard key={request.id} account={account} request={request} />)
			)}
		</Page>
	);
}
