import { Link, useNavigate } from "react-router";
import { Avatar } from "../../ui/Avatar.tsx";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { SimulatedTag } from "../../ui/SimulatedTag.tsx";
import { useT } from "../../ui/useLanguage.ts";
import { InstallHint } from "../install/InstallHint.tsx";
import { GuardianCard } from "../lifeline/GuardianCard.tsx";
import { LifelineCard } from "../lifeline/LifelineCard.tsx";
import { RecoverPassCard } from "../lifeline/RecoverPassCard.tsx";
import { useLifeline } from "../lifeline/useLifeline.ts";
import { roleLabel } from "../requests/describe.ts";
import { DataSourceCard } from "../settings/DataSourceCard.tsx";
import type { ThemePreference } from "../workspace/preferences.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import { DeviceKeysCard } from "./DeviceKeysCard.tsx";
import { DevicesSection } from "./DevicesSection.tsx";
import { EditProfileCard } from "./EditProfileCard.tsx";
import { NotificationsCard } from "./NotificationsCard.tsx";
import { PassCard } from "./PassCard.tsx";
import styles from "./ProfilePage.module.css";

/**
 * The person, not the organization: their pass (ID, picture, name), the positions they hold,
 * how they sign in and recover, and the preferences of this device.
 */
export function ProfilePage() {
	const t = useT();
	const { dataSource, me, myAccounts, workspace, preferences, updatePreferences } = useWorkspace();
	const navigate = useNavigate();
	const identity = dataSource.identity;
	const lifeline = useLifeline();

	return (
		<Page title={t("You")} lead={t("One pass for every organization you work with.")}>
			<PassCard person={me} onchain={identity !== null} positions={myAccounts.length} />

			{identity ? (
				<EditProfileCard key={`${me.id}-${me.name}-${me.avatarUrl ?? ""}`} identity={identity} />
			) : (
				<div id="viewing-as">
					<Card title={t("Viewing as")} action={<SimulatedTag label={t("Demo")} />}>
						<Field
							label={t("Person")}
							htmlFor="person"
							hint={t(
								"Switch people to see the demo from their side. Signatures are simulated on sample data.",
							)}
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

			<Card title={t("Your positions")}>
				{myAccounts.length === 0 ? (
					<p className={styles.muted}>
						{t("No positions yet.")} <Link to="/app/new">{t("Create an organization")}</Link>{" "}
						{t("or share your ancora ID with one that wants to invite you.")}
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
											{account.org.founderId === me.id && t(" · founder")}
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
										{t("Open")}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</Card>

			<Card title={t("Sign-in and recovery")}>
				{identity ? (
					<>
						<dl className={styles.facts}>
							<div>
								<dt>{t("Login")}</dt>
								<dd>
									{t(
										"Your passkey on this device. It signs every approval through your own account on Stellar; the private key never leaves the device.",
									)}
								</dd>
							</div>
							<DevicesSection identity={identity} />
							<div>
								<dt>{t("Recovery")}</dt>
								<dd>
									{lifeline.overview?.plan ? (
										<>
											<span className={styles.protected}>{t("Protected by Lifeline")}</span>:{" "}
											{t(
												"{needed} of {total} guardians can confirm a new pass for you. Details below.",
												{
													needed: lifeline.overview.plan.threshold,
													total: lifeline.overview.plan.guardians.length,
												},
											)}
										</>
									) : (
										<>
											<span className={styles.warn}>{t("Not protected yet")}</span>
											{t(
												": this passkey is the only key to your positions. Name guardians in Lifeline below.",
											)}
										</>
									)}
								</dd>
							</div>
						</dl>
						<div className={styles.actions}>
							<button
								type="button"
								className={buttonClass("secondary")}
								onClick={() => void identity.signOut()}
							>
								{t("Sign out")}
							</button>
							<span className={styles.muted}>
								{t("Sign out to use another passkey on this device.")}
							</span>
						</div>
					</>
				) : (
					<p className={styles.muted}>
						{t(
							"Sample data: signatures are simulated. Switch to the Stellar testnet below to sign in with a real passkey.",
						)}
					</p>
				)}
			</Card>

			<LifelineCard
				overview={lifeline.overview}
				error={lifeline.error}
				onChanged={lifeline.reload}
			/>
			<GuardianCard overview={lifeline.overview} onChanged={lifeline.reload} />
			<RecoverPassCard />

			<Card title={t("Appearance")}>
				<Segmented<ThemePreference>
					label={t("Theme")}
					value={preferences.theme}
					onChange={(theme) => updatePreferences({ theme })}
					options={[
						{ value: "system", label: t("System") },
						{ value: "light", label: t("Light") },
						{ value: "dark", label: t("Dark") },
					]}
				/>
			</Card>

			<Card title={t("Expert mode")}>
				<label className={styles.toggle}>
					<input
						type="checkbox"
						checked={preferences.expertMode}
						onChange={(e) => updatePreferences({ expertMode: e.target.checked })}
					/>
					{t(
						"Show technical references (request IDs, rule tiers, on-chain links, the rules document).",
					)}
				</label>
			</Card>

			<Card title={t("Install the app")}>
				<p className={styles.muted}>
					{t(
						"ancora works in any phone browser and can be added to your home screen. No app store needed.",
					)}
				</p>
				<InstallHint />
			</Card>

			<DeviceKeysCard />
			<NotificationsCard />
			<DataSourceCard />
		</Page>
	);
}
