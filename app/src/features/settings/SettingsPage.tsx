import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { InstallHint } from "../install/InstallHint.tsx";
import type { ThemePreference } from "../workspace/preferences.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { LogoCard } from "./LogoCard.tsx";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
	const { active, preferences, updatePreferences, dataSource, workspace, me } = useWorkspace();

	return (
		<Page title="Settings">
			{active && <LogoCard key={active.org.id} account={active} />}

			<Card title="Appearance">
				<Segmented<ThemePreference>
					label="Theme"
					value={preferences.theme}
					onChange={(theme) => updatePreferences({ theme })}
					options={[
						{ value: "system", label: "System" },
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
					]}
				/>
			</Card>

			<Card title="Expert mode">
				<label className={styles.toggle}>
					<input
						type="checkbox"
						checked={preferences.expertMode}
						onChange={(e) => updatePreferences({ expertMode: e.target.checked })}
					/>
					Show technical references (request IDs, rule tiers, on-chain links) on request pages.
				</label>
			</Card>

			<Card title="Install the app">
				<p className={styles.muted}>
					ancora works in any phone browser and can be added to your home screen. No app store
					needed.
				</p>
				<InstallHint />
			</Card>

			<Card title="Data source" action={dataSource.kind === "sample" ? <SimulatedTag /> : null}>
				<p>
					{dataSource.kind === "sample"
						? "Sample data: realistic organizations that behave like the real thing, stored in this browser. Nothing is sent to the Stellar testnet."
						: "Stellar testnet."}
				</p>
			</Card>

			{dataSource.kind === "sample" && (
				<div id="viewing-as">
					<Card title="Viewing as" action={<SimulatedTag />}>
						<Field
							label="Person"
							htmlFor="person"
							hint="Switch people to approve requests from their side. Replaced by passkey sign-in on testnet."
						>
							<select
								id="person"
								className={controlClass}
								value={me.id}
								onChange={(e) => updatePreferences({ personId: e.target.value, activeOrgId: null })}
							>
								{workspace.people.map((person) => (
									<option key={person.id} value={person.id}>
										{person.name}
									</option>
								))}
							</select>
						</Field>
					</Card>
				</div>
			)}
		</Page>
	);
}
