import { createBrowserRouter } from "react-router";
import { AdminPage } from "./features/admin/AdminPage.tsx";
import { LandingPage } from "./features/landing/LandingPage.tsx";
import { AppShell } from "./features/shell/AppShell.tsx";
import { NotFoundPage } from "./features/shell/NotFoundPage.tsx";
import { ScreenPlaceholder } from "./features/shell/ScreenPlaceholder.tsx";

export const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
	{
		path: "/app",
		element: <AppShell />,
		children: [
			{ index: true, element: <ScreenPlaceholder title="Overview" /> },
			{ path: "inbox", element: <ScreenPlaceholder title="Inbox" /> },
			{ path: "approvals", element: <ScreenPlaceholder title="Approvals" /> },
			{ path: "pay", element: <ScreenPlaceholder title="Send money" /> },
			{ path: "rules", element: <ScreenPlaceholder title="Rules" /> },
			{ path: "settings", element: <ScreenPlaceholder title="Settings" /> },
			{ path: "new", element: <ScreenPlaceholder title="New organization" /> },
		],
	},
	{ path: "/admin", element: <AdminPage /> },
	{ path: "*", element: <NotFoundPage /> },
]);
