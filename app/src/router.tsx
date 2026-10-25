import { createBrowserRouter } from "react-router";
import { AdminPage } from "./features/admin/AdminPage.tsx";
import { ApprovalsPage } from "./features/approvals/ApprovalsPage.tsx";
import { RequestDetailPage } from "./features/approvals/RequestDetailPage.tsx";
import { InboxPage } from "./features/inbox/InboxPage.tsx";
import { LandingPage } from "./features/landing/LandingPage.tsx";
import { NoticeProvider } from "./features/notices/NoticeProvider.tsx";
import { NewOrgPage } from "./features/orgs/NewOrgPage.tsx";
import { OverviewPage } from "./features/overview/OverviewPage.tsx";
import { PasskeyProvider } from "./features/passkey/PasskeyProvider.tsx";
import { PayPage } from "./features/pay/PayPage.tsx";
import { ProfilePage } from "./features/profile/ProfilePage.tsx";
import { RulesPage } from "./features/rules/RulesPage.tsx";
import { SettingsPage } from "./features/settings/SettingsPage.tsx";
import { AppShell } from "./features/shell/AppShell.tsx";
import { NotFoundPage } from "./features/shell/NotFoundPage.tsx";
import { WorkspaceProvider } from "./features/workspace/WorkspaceProvider.tsx";

/** App state, notices and signature prompts exist only under /app; the landing page stays light. */
function AppProviders() {
	return (
		<WorkspaceProvider>
			<NoticeProvider>
				<PasskeyProvider>
					<AppShell />
				</PasskeyProvider>
			</NoticeProvider>
		</WorkspaceProvider>
	);
}

export const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
	{
		path: "/app",
		element: <AppProviders />,
		children: [
			{ index: true, element: <OverviewPage /> },
			{ path: "inbox", element: <InboxPage /> },
			{ path: "approvals", element: <ApprovalsPage /> },
			{ path: "approvals/:requestId", element: <RequestDetailPage /> },
			{ path: "pay", element: <PayPage /> },
			{ path: "rules", element: <RulesPage /> },
			{ path: "settings", element: <SettingsPage /> },
			{ path: "me", element: <ProfilePage /> },
			{ path: "new", element: <NewOrgPage /> },
		],
	},
	{ path: "/admin", element: <AdminPage /> },
	{ path: "*", element: <NotFoundPage /> },
]);
