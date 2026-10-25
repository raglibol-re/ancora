import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { CURRENCIES, type Currency } from "../../domain/money.ts";
import type { TemplateId } from "../../domain/rules/model.ts";
import { templates } from "../../domain/rules/templates.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { Segmented } from "../../ui/Segmented.tsx";
import { describeRequirements } from "../requests/describe.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./NewOrgPage.module.css";

export function NewOrgPage() {
	const { dataSource, me, updatePreferences } = useWorkspace();
	const onTestnet = dataSource.kind === "testnet";
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const options = dataSource.availableAssets;
	// Default to the currency the available assets are in; most testnet assets are dollars.
	const defaultCurrency: Currency = options.some((a) => a.currency === "EUR") ? "EUR" : "USD";
	const [name, setName] = useState("");
	const [templateId, setTemplateId] = useState<TemplateId>("club");
	const [roleId, setRoleId] = useState(templates.club.roles[0]?.id ?? "");
	const [baseCurrency, setBaseCurrency] = useState<Currency>(defaultCurrency);
	const [assets, setAssets] = useState<string[]>(options.map((a) => a.token));
	const [error, setError] = useState<string | null>(null);
	const template = templates[templateId];

	const chooseTemplate = (id: TemplateId) => {
		setTemplateId(id);
		setRoleId(templates[id].roles[0]?.id ?? "");
	};

	const toggleAsset = (token: string) =>
		setAssets((current) =>
			current.includes(token) ? current.filter((t) => t !== token) : [...current, token],
		);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			setError("Give your organization a name.");
			return;
		}
		if (assets.length === 0) {
			setError("Pick at least one asset the organization accepts.");
			return;
		}
		setError(null);
		const result = await run(
			() =>
				dataSource.createOrganization({
					actorId: me.id,
					name,
					templateId,
					founderRoleId: roleId,
					baseCurrency,
					assets,
				}),
			{
				signature: { kind: "passkey", title: `Create ${name.trim()}` },
				success: onTestnet
					? "Organization created on Stellar. Invite your people by their ancora ID next."
					: "Organization created. Add your people next.",
			},
		);
		if (result?.ok) {
			updatePreferences({ activeOrgId: result.value });
			navigate("/app/rules");
		}
	};

	return (
		<Page
			title="New organization"
			lead={
				onTestnet
					? "Deploys the organization's own contract on Stellar testnet with you as its founder. Fees are sponsored; no signature needed for this step."
					: "An account with your own approval rules, in a minute."
			}
		>
			<form className={styles.form} onSubmit={submit} noValidate>
				<Card>
					<Field label="Name" htmlFor="org-name" error={error}>
						<input
							id="org-name"
							className={controlClass}
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
				</Card>

				<fieldset className={styles.templates}>
					<legend>Template</legend>
					{Object.values(templates).map((t) => (
						<label key={t.id} className={styles.template}>
							<input
								type="radio"
								name="template"
								value={t.id}
								checked={t.id === templateId}
								onChange={() => chooseTemplate(t.id)}
							/>
							<span className={styles.templateName}>{t.label}</span>
							<span className={styles.templateRoles}>{t.roles.map((r) => r.name).join(" · ")}</span>
							<ul className={styles.tiers}>
								{t.policy.tiers.map((tier) => (
									<li key={tier.upTo ?? "unbounded"}>
										{tier.upTo === null ? "Above" : `Up to ${formatMoney(tier.upTo, baseCurrency)}`}
										: {describeRequirements(t, tier.approvals)}
										{tier.objectionWindowHours > 0 &&
											`, ${tier.objectionWindowHours}h objection window`}
									</li>
								))}
								<li>Security seal from {formatMoney(t.policy.sealThreshold, baseCurrency)}</li>
							</ul>
						</label>
					))}
				</fieldset>

				<Card title="Money">
					<Segmented<Currency>
						label="Currency of the rules"
						value={baseCurrency}
						onChange={setBaseCurrency}
						options={CURRENCIES.map((c) => ({ value: c, label: c }))}
					/>
					<p className={styles.hint}>
						The tiers above are in this currency. Payments in an accepted asset of another currency
						take the strictest tier.
					</p>
					<fieldset className={styles.assets}>
						<legend>Accepted stablecoins</legend>
						{options.map((option) => (
							<label key={option.token} className={styles.asset}>
								<input
									type="checkbox"
									checked={assets.includes(option.token)}
									onChange={() => toggleAsset(option.token)}
								/>
								{option.label}
							</label>
						))}
					</fieldset>
				</Card>

				<Card>
					<Field
						label="Your role"
						htmlFor="own-role"
						hint="You can add people and adjust the rules right after."
					>
						<select
							id="own-role"
							className={controlClass}
							value={roleId}
							onChange={(e) => setRoleId(e.target.value)}
						>
							{template.roles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.name}
								</option>
							))}
						</select>
					</Field>
				</Card>

				<button type="submit" className={buttonClass()} disabled={busy}>
					Create organization
				</button>
			</form>
		</Page>
	);
}
