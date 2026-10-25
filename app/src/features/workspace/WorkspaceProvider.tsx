import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { SampleDataSource } from "../../adapters/sample/sampleDataSource.ts";
import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import { accountsOf } from "../../domain/account.ts";
import type { DataSource } from "../../domain/dataSource.ts";
import {
	browserStorage,
	loadPreferences,
	type Preferences,
	savePreferences,
} from "./preferences.ts";
import { WorkspaceContext, type WorkspaceValue } from "./WorkspaceContext.ts";
import styles from "./WorkspaceProvider.module.css";

const storage = browserStorage();
const sample = new SampleDataSource(storage);
let testnet: DataSource | null = null;

/**
 * The testnet adapter pulls in the Stellar SDK and smart-account-kit, so it loads on demand and
 * sample-data visitors never download it. Only builds with testnet deployment IDs offer it.
 */
async function loadTestnet(): Promise<DataSource | null> {
	if (!testnetConfig) return null;
	if (!testnet) {
		const { TestnetDataSource } = await import("../../adapters/testnet/testnetDataSource.ts");
		testnet = new TestnetDataSource(storage, testnetConfig);
	}
	return testnet;
}

const BALANCE_REFRESH_MS = 30_000;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [preferences, setPreferences] = useState(() => loadPreferences(storage));
	const [testnetSource, setTestnetSource] = useState(testnet);
	const wantsTestnet = preferences.dataSource === "testnet" && testnetConfig !== null;

	useEffect(() => {
		if (wantsTestnet && !testnetSource) void loadTestnet().then(setTestnetSource);
	}, [wantsTestnet, testnetSource]);

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

	const dataSource = wantsTestnet ? testnetSource : sample;
	if (!dataSource) return <p className={styles.connecting}>Connecting to Stellar testnet…</p>;
	return (
		<WorkspaceState
			dataSource={dataSource}
			preferences={preferences}
			updatePreferences={updatePreferences}
		>
			{children}
		</WorkspaceState>
	);
}

type WorkspaceStateProps = {
	dataSource: DataSource;
	preferences: Preferences;
	updatePreferences: (patch: Partial<Preferences>) => void;
	children: ReactNode;
};

function WorkspaceState({
	dataSource,
	preferences,
	updatePreferences,
	children,
}: WorkspaceStateProps) {
	const workspace = useSyncExternalStore(dataSource.subscribe, dataSource.getSnapshot);

	// On-chain balances change outside the app (incoming transfers), so poll while visible.
	useEffect(() => {
		if (dataSource.kind !== "testnet") return;
		void dataSource.refresh();
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") void dataSource.refresh();
		}, BALANCE_REFRESH_MS);
		return () => clearInterval(timer);
	}, [dataSource]);

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
	}, [dataSource, workspace, preferences, updatePreferences]);

	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
