import { Link, useNavigate } from "react-router";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { InstallHint } from "../install/InstallHint.tsx";
import { roleLabel } from "../requests/describe.ts";
import { DataSourceCard } from "../settings/DataSourceCard.tsx";
import type { ThemePreference } from "../workspace/preferences.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { EditProfileCard } from "./EditProfileCard.tsx";
import { PassCard } from "./PassCard.tsx";
import styles from "./ProfilePage.module.css";

/**
 * The person, not the organization: their pass (ID, picture, name), the positions they hold,
 * how they sign in and recover, and the preferences of this device.
 */
export function ProfilePage() {
	const { dataSource, me, myAccounts, workspace, preferences, updatePreferences } = useWorkspace();
	const navigate = useNavigate();
	const identity = dataSource.identity;

	return (
		<Page title="You" lead="One pass for every organization you work with.">
			<PassCard person={me} onchain={identity !== null} positions={myAccounts.length} />

			{identity ? (
				<EditProfileCard key={`${me.id}-${me.name}-${me.avatarUrl ?? ""}`} identity={identity} />
			) : (
				<div id="viewing-as">
					<Card title="Viewing as" action={<SimulatedTag label="Demo" />}>
						<Field
							label="Person"
							htmlFor="person"
							hint="Switch people to see the demo from their side. Signatures are simulated on sample data."
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

			<Card title="Your positions">
				{myAccounts.length === 0 ? (
					<p className={styles.muted}>
						No positions yet. <Link to="/app/new">Create an organization</Link> or share your ancora
						ID with one that wants to invite you.
					</p>
				) : (
					<ul className={styles.positions}>
						{myAccounts.map((account) => {
							const member = account.org.members.find((m) => m.personId === me.id);
							return (
								<li key={account.org.id} className={styles.position}>
									<Avatar name={account.org.name} imageUrl={account.logoUrl} />
									<span className={styles.positionText}>
										<span className={styles.positionOrg}>{account.org.name}</span>
										<span className={styles.muted}>
											{member ? roleLabel(account.org, member.roleId) : "Member"}
											{account.org.founderId === me.id && " · founder"}
										</span>
									</span>
									<button
										type="button"
										className={buttonClass("secondary")}
										onClick={() => {
											updatePreferences({ activeOrgId: account.org.id });
											navigate("/app");
										}}
									>
										Open
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</Card>

			<Card title="Sign-in and recovery">
				{identity ? (
					<>
						<dl className={styles.facts}>
							<div>
								<dt>Login</dt>
								<dd>
									Your passkey on this device. It signs every approval through your own account on
									Stellar; the private key never leaves the device.
								</dd>
							</div>
							<div>
								<dt>Recovery</dt>
								<dd>
									<span className={styles.warn}>Not protected yet</span> — this passkey is the only
									key to your account. A recovery device and guardians ("Lifeline") are next on the
									roadmap; until then, keep this device safe.
								</dd>
							</div>
						</dl>
						<div className={styles.actions}>
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => void identity.signOut()}
							>
								Sign out
							</button>
							<span className={styles.muted}>Sign out to use another passkey on this device.</span>
						</div>
					</>
				) : (
					<p className={styles.muted}>
						Sample data: signatures are simulated. Switch to the Stellar testnet below to sign in
						with a real passkey.
					</p>
				)}
			</Card>

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
					Show technical references (request IDs, rule tiers, on-chain links, the rules document).
				</label>
			</Card>

			<Card title="Install the app">
				<p className={styles.muted}>
					ancora works in any phone browser and can be added to your home screen. No app store
					needed.
				</p>
				<InstallHint />
			</Card>

			<DataSourceCard />
		</Page>
	);
}
