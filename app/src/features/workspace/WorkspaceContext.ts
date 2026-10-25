import { createContext, useContext } from "react";
import type { OrgAccount, Person, Workspace } from "../../domain/account.ts";
import type { DataSource } from "../../domain/dataSource.ts";
import type { Preferences } from "./preferences.ts";

export type WorkspaceValue = {
	dataSource: DataSource;
	workspace: Workspace;
	preferences: Preferences;
	updatePreferences: (patch: Partial<Preferences>) => void;
	/** The person using the app. */
	me: Person;
	/** Organizations this person belongs to. */
	myAccounts: OrgAccount[];
	/** The organization currently shown; null if the person belongs to none. */
	active: OrgAccount | null;
	personName: (personId: string) => string;
};

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
	const value = useContext(WorkspaceContext);
	if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
	return value;
}
