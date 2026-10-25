import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { SampleDataSource } from "../../adapters/sample/sampleDataSource.ts";
import { fetchSiteHealth } from "../../adapters/site/siteHealth.ts";
import { testnetConfig } from "../../adapters/testnet/testnetConfig.ts";
import { accountsOf } from "../../domain/account.ts";
import type { DataSource } from "../../domain/dataSource.ts";
import {
	browserStorage,
	loadPreferences,
	type Preferences,
	savePreferences,
} from "./preferences.ts";
import { resolveDataSource, type SiteHealth } from "./resolveDataSource.ts";
import { type SourceStatus, WorkspaceContext, type WorkspaceValue } from "./WorkspaceContext.ts";
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
	const [health, setHealth] = useState<SiteHealth | null>(null);
	const [testnetSource, setTestnetSource] = useState(testnet);

	const checkHealth = useCallback(() => {
		setHealth(null);
		void fetchSiteHealth().then(setHealth);
	}, []);
	useEffect(checkHealth, [checkHealth]);

	const resolution = resolveDataSource(preferences.dataSource, health, testnetConfig !== null);
	const wantsTestnet = resolution?.effective === "testnet";

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

	if (!resolution) return <p className={styles.connecting}>Checking the Stellar testnet…</p>;
	const dataSource = wantsTestnet ? testnetSource : sample;
	if (!dataSource) return <p className={styles.connecting}>Connecting to Stellar testnet…</p>;

	return (
		<WorkspaceState
			dataSource={dataSource}
			sourceStatus={{
				demoMode: resolution.demoMode,
				fallbackReason: resolution.fallbackReason,
				retry: checkHealth,
			}}
			preferences={preferences}
			updatePreferences={updatePreferences}
		>
			{children}
		</WorkspaceState>
	);
}

type WorkspaceStateProps = {
	dataSource: DataSource;
	sourceStatus: SourceStatus;
	preferences: Preferences;
	updatePreferences: (patch: Partial<Preferences>) => void;
	children: ReactNode;
};

function WorkspaceState({
	dataSource,
	sourceStatus,
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
			sourceStatus,
			workspace,
			preferences,
			updatePreferences,
			me,
			myAccounts,
			active,
			personName: (personId) => names.get(personId) ?? "Unknown person",
		};
	}, [dataSource, sourceStatus, workspace, preferences, updatePreferences]);

	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
