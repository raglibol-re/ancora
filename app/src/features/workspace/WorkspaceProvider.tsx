import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { SampleDataSource } from "../../adapters/sample/sampleDataSource.ts";
import { accountsOf } from "../../domain/account.ts";
import {
	browserStorage,
	loadPreferences,
	type Preferences,
	savePreferences,
} from "./preferences.ts";
import { WorkspaceContext, type WorkspaceValue } from "./WorkspaceContext.ts";

const storage = browserStorage();
// The testnet adapter (task 4) plugs in here behind the same DataSource interface.
const dataSource = new SampleDataSource(storage);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const workspace = useSyncExternalStore(dataSource.subscribe, dataSource.getSnapshot);
	const [preferences, setPreferences] = useState(() => loadPreferences(storage));

	const updatePreferences = useCallback((patch: Partial<Preferences>) => {
		setPreferences((current) => {
			const next = { ...current, ...patch };
			savePreferences(storage, next);
			return next;
		});
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		if (preferences.theme === "system") delete root.dataset.theme;
		else root.dataset.theme = preferences.theme;
	}, [preferences.theme]);

	const value = useMemo<WorkspaceValue>(() => {
		const me = workspace.people.find((p) => p.id === preferences.personId) ??
			workspace.people[0] ?? { id: preferences.personId, name: "You" };
		const myAccounts = accountsOf(workspace, me.id);
		const active =
			myAccounts.find((a) => a.org.id === preferences.activeOrgId) ?? myAccounts[0] ?? null;
		const names = new Map(workspace.people.map((p) => [p.id, p.name]));
		return {
			dataSource,
			workspace,
			preferences,
			updatePreferences,
			me,
			myAccounts,
			active,
			personName: (personId) => names.get(personId) ?? "Unknown person",
		};
	}, [workspace, preferences, updatePreferences]);

	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
