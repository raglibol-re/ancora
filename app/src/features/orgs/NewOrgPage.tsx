import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import type { TemplateId } from "../../domain/rules/model.ts";
import { templates } from "../../domain/rules/templates.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { Page } from "../../ui/Page.tsx";
import { describeRequirements } from "../requests/describe.ts";
import { useCommand } from "../workspace/useCommand.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./NewOrgPage.module.css";

export function NewOrgPage() {
	const { dataSource, me, updatePreferences } = useWorkspace();
	const onTestnet = dataSource.kind === "testnet";
	const { run, busy } = useCommand();
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [templateId, setTemplateId] = useState<TemplateId>("club");
	const [roleId, setRoleId] = useState(templates.club.roles[0]?.id ?? "");
	const [error, setError] = useState<string | null>(null);
	const template = templates[templateId];

	const chooseTemplate = (id: TemplateId) => {
		setTemplateId(id);
		setRoleId(templates[id].roles[0]?.id ?? "");
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			setError("Give your organization a name.");
			return;
		}
		setError(null);
		const result = await run(
			() =>
				dataSource.createOrganization({ actorId: me.id, name, templateId, founderRoleId: roleId }),
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
										{tier.upTo === null ? "Above" : `Up to ${formatMoney(tier.upTo)}`}:{" "}
										{describeRequirements(t, tier.approvals)}
										{tier.objectionWindowHours > 0 &&
											`, ${tier.objectionWindowHours}h objection window`}
									</li>
								))}
								<li>Security seal from {formatMoney(t.policy.sealThreshold)}</li>
							</ul>
						</label>
					))}
				</fieldset>

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
