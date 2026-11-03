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
import { useT } from "../../ui/useLanguage.ts";
import { describeRequirements } from "../requests/describe.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./NewOrgPage.module.css";

export function NewOrgPage() {
	const t = useT();
	const { dataSource, me, updatePreferences } = useWorkspace();
	const onTestnet = dataSource.kind === "testnet";
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const options = dataSource.availableAssets;
	// The first allowlisted asset is the one with automatic test money, so its currency leads.
	const defaultCurrency: Currency = options[0]?.currency ?? "EUR";
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
			setError(t("Give your organization a name."));
			return;
		}
		if (assets.length === 0) {
			setError(t("Pick at least one asset the organization accepts."));
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
				signature: { kind: "passkey", title: t("Create {name}", { name: name.trim() }) },
				success: onTestnet
					? t("Organization created on Stellar. Invite your people by their ancora ID next.")
					: t("Organization created. Add your people next."),
			},
		);
		if (result?.ok) {
			updatePreferences({ activeOrgId: result.value });
			navigate("/app/rules");
		}
	};

	return (
		<Page
			title={t("New organization")}
			lead={
				onTestnet
					? t(
							"Deploys the organization's own contract on Stellar testnet with you as its founder. Fees are sponsored; no signature needed for this step.",
						)
					: t("An account with your own approval rules, in a minute.")
			}
		>
			<form className={styles.form} onSubmit={submit} noValidate>
				<Card>
					<Field label={t("Name")} htmlFor="org-name" error={error}>
						<input
							id="org-name"
							className={controlClass}
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</Field>
				</Card>

				<fieldset className={styles.templates}>
					<legend>{t("Template")}</legend>
					{Object.values(templates).map((template) => (
						<label key={template.id} className={styles.template}>
							<input
								type="radio"
								name="template"
								value={template.id}
								checked={template.id === templateId}
								onChange={() => chooseTemplate(template.id)}
							/>
							<span className={styles.templateName}>{template.label}</span>
							<span className={styles.templateRoles}>
								{template.roles.map((r) => r.name).join(" · ")}
							</span>
							<ul className={styles.tiers}>
								{template.policy.tiers.map((tier) => (
									<li key={tier.upTo ?? "unbounded"}>
										{tier.upTo === null
											? t("Above")
											: t("Up to {amount}", { amount: formatMoney(tier.upTo, baseCurrency) })}
										: {describeRequirements(template, tier.approvals)}
										{tier.objectionWindowHours > 0 &&
											`, ${t("{hours}h objection window", { hours: tier.objectionWindowHours })}`}
									</li>
								))}
								<li>
									{t("Security seal from")}{" "}
									{formatMoney(template.policy.sealThreshold, baseCurrency)}
								</li>
							</ul>
						</label>
					))}
				</fieldset>

				<Card title={t("Money")}>
					<Segmented<Currency>
						label={t("Currency of the rules")}
						value={baseCurrency}
						onChange={setBaseCurrency}
						options={CURRENCIES.map((c) => ({ value: c, label: c }))}
					/>
					<p className={styles.hint}>
						{t(
							"The tiers above are in this currency. Payments in an accepted asset of another currency take the strictest tier.",
						)}
					</p>
					<fieldset className={styles.assets}>
						<legend>{t("Accepted stablecoins")}</legend>
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
						label={t("Your role")}
						htmlFor="own-role"
						hint={t("You can add people and adjust the rules right after.")}
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
					{t("Create organization")}
				</button>
			</form>
		</Page>
	);
}
