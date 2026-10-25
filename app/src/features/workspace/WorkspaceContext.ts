import { createContext, useContext } from "react";
import type { OrgAccount, Person, Workspace } from "../../domain/account.ts";
import type { DataSource } from "../../domain/dataSource.ts";
import type { Preferences } from "./preferences.ts";
import type { DemoMode } from "./resolveDataSource.ts";

export type SourceStatus = {
	/** Site-wide default set by the demo admin; null while unknown. */
	demoMode: DemoMode | null;
	/** Set when the testnet was wanted but sample data is shown instead. */
	fallbackReason: string | null;
	/** Re-checks the site health and switches back to the testnet if it answers. */
	retry: () => void;
};

export type WorkspaceValue = {
	dataSource: DataSource;
	sourceStatus: SourceStatus;
	workspace: Workspace;
	preferences: Preferences;
	updatePreferences: (patch: Partial<Preferences>) => void;
	/** The person using the app: the signed-in identity on testnet, the chosen person on sample data. */
	me: Person;
	/** Organizations this person belongs to. */
	myAccounts: OrgAccount[];
	/** The organization currently shown; null if the person belongs to none. */
	active: OrgAccount | null;
	personName: (personId: string) => string;
	/** Name and picture of anyone referenced by id; unknown people get a placeholder. */
	personOf: (personId: string) => Person;
};

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
	const value = useContext(WorkspaceContext);
	if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
	return value;
}
