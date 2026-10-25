import { useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import type { TemplateId } from "../../domain/rules/model.ts";
import { templates } from "../../domain/rules/templates.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import styles from "./TemplateCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/** Switching template maps everyone onto the new roles by rank and resets the tiers. */
export function TemplateCard({ account }: { account: OrgAccount }) {
	const { propose, busy } = useProposeChange(account);
	const current = account.org.templateId;
	const [choice, setChoice] = useState<TemplateId>(current);
	const target = templates[choice];

	return (
		<Card title="Template">
			<p>
				Based on the <strong>{templates[current].label.toLowerCase()}</strong> template.
			</p>
			<div className={styles.row}>
				<Field
					label="Switch template"
					htmlFor="template"
					hint="People keep their rank (highest role to highest role), so nobody silently loses access. Tier limits reset to the template's defaults."
				>
					<select
						id="template"
						className={controlClass}
						value={choice}
						onChange={(e) => setChoice(e.target.value as TemplateId)}
					>
						{Object.values(templates).map((t) => (
							<option key={t.id} value={t.id}>
								{t.label}: {t.roles.map((r) => r.name).join(", ")}
							</option>
						))}
					</select>
				</Field>
				<button
					type="button"
					className={buttonClass("secondary")}
					disabled={busy || choice === current}
					onClick={() => propose({ type: "switchTemplate", templateId: target.id })}
				>
					Switch
				</button>
			</div>
		</Card>
	);
}
