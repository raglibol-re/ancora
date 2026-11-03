import { type FormEvent, useState } from "react";
import type { OrgAccount } from "../../domain/account.ts";
import { parseAmountInput } from "../../domain/money.ts";
import { LIMIT_PERIODS, periodLabel, remainingAllowance } from "../../domain/rules/limits.ts";
import type { Allowance } from "../../domain/rules/model.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useT } from "../../ui/useLanguage.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./Controls.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * Allowances for one asset and/or one budget category: payments inside them need no approvals.
 * The general allowance per person stays under People & limits.
 */
export function AllowancesCard({ account }: { account: OrgAccount }) {
	const t = useT();
	const { personName } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { org } = account;
	const [personId, setPersonId] = useState(org.members[0]?.personId ?? "");
	const [token, setToken] = useState("");
	const [category, setCategory] = useState("");
	const [amountInput, setAmountInput] = useState("");
	const [period, setPeriod] = useState(LIMIT_PERIODS[2]?.seconds ?? 30 * 86_400);
	const [error, setError] = useState<string | null>(null);
	const now = Date.now();
	const rows = org.members.flatMap((m) =>
		(m.allowances ?? []).map((allowance) => ({ personId: m.personId, allowance })),
	);
	const currencyFor = (t: string | null) =>
		org.assets.find((a) => a.token === t)?.currency ?? org.baseCurrency;
	const scope = (a: Pick<Allowance, "token" | "category">) =>
		[
			a.token ? `in ${org.assets.find((x) => x.token === a.token)?.symbol ?? t("an asset")}` : null,
			a.category ? `for #${a.category}` : null,
		]
			.filter(Boolean)
			.join(" ");

	const remove = (row: (typeof rows)[number]) =>
		propose({
			type: "setAllowance",
			personId: row.personId,
			token: row.allowance.token,
			category: row.allowance.category,
			amount: 0,
			periodSeconds: 0,
		});

	const add = async (event: FormEvent) => {
		event.preventDefault();
		const amount = parseAmountInput(amountInput);
		if (!token && !category) {
			setError(
				t("Pick an asset or a budget category; the general allowance is under People & limits."),
			);
			return;
		}
		if (amount === null || amount <= 0) {
			setError(t("Enter an amount like 200 or 1,500."));
			return;
		}
		setError(null);
		const result = await propose({
			type: "setAllowance",
			personId,
			token: token || null,
			category: category || null,
			amount,
			periodSeconds: period,
		});
		if (result?.ok) setAmountInput("");
	};

	return (
		<Card title={t("Allowances by asset or category")}>
			<p className={styles.muted}>
				{t(
					"Let someone pay up to an amount per period without approvals, only in one asset or only for one budget category. Recipients outside an allowlist never use an allowance.",
				)}
			</p>
			{rows.length > 0 && (
				<ul className={styles.list}>
					{rows.map((row) => (
						<li
							key={`${row.personId}-${row.allowance.token}-${row.allowance.category}`}
							className={styles.item}
						>
							<span>
								{personName(row.personId)} {scope(row.allowance)}:{" "}
								{t("{left} of {total} left this {period}", {
									left: formatMoney(
										remainingAllowance(row.allowance, now),
										currencyFor(row.allowance.token),
									),
									total: formatMoney(row.allowance.amount, currencyFor(row.allowance.token)),
									period: t(periodLabel(row.allowance.periodSeconds)),
								})}
							</span>
							<button
								type="button"
								className={buttonClass("secondary")}
								disabled={busy}
								onClick={() => remove(row)}
							>
								{t("Remove")}
							</button>
						</li>
					))}
				</ul>
			)}
			<form className={styles.form} onSubmit={add} noValidate>
				<div className={styles.row}>
					<Field label={t("Person")} htmlFor="allowance-person">
						<select
							id="allowance-person"
							className={controlClass}
							value={personId}
							onChange={(e) => setPersonId(e.target.value)}
						>
							{org.members.map((m) => (
								<option key={m.personId} value={m.personId}>
									{personName(m.personId)}
								</option>
							))}
						</select>
					</Field>
					<Field label={t("Asset")} htmlFor="allowance-asset">
						<select
							id="allowance-asset"
							className={controlClass}
							value={token}
							onChange={(e) => setToken(e.target.value)}
						>
							<option value="">
								{t("Any, counted in {currency}", { currency: org.baseCurrency })}
							</option>
							{org.assets.map((a) => (
								<option key={a.token} value={a.token}>
									{a.symbol} ({a.currency})
								</option>
							))}
						</select>
					</Field>
					<Field label={t("Category")} htmlFor="allowance-category">
						<select
							id="allowance-category"
							className={controlClass}
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						>
							<option value="">{t("Any")}</option>
							{org.policy.budgets.map((b) => (
								<option key={b.category} value={b.category}>
									#{b.category}
								</option>
							))}
						</select>
					</Field>
				</div>
				<div className={styles.row}>
					<Field
						label={t("Amount ({currency})", { currency: currencyFor(token || null) })}
						htmlFor="allowance-amount"
					>
						<input
							id="allowance-amount"
							className={controlClass}
							inputMode="decimal"
							placeholder="200"
							value={amountInput}
							onChange={(e) => setAmountInput(e.target.value)}
						/>
					</Field>
					<Field label={t("Per")} htmlFor="allowance-period">
						<select
							id="allowance-period"
							className={controlClass}
							value={period}
							onChange={(e) => setPeriod(Number(e.target.value))}
						>
							{LIMIT_PERIODS.map((p) => (
								<option key={p.seconds} value={p.seconds}>
									{t(p.label)}
								</option>
							))}
						</select>
					</Field>
				</div>
				{error && (
					<p className={styles.error} role="alert">
						{t(error)}
					</p>
				)}
				<button type="submit" className={buttonClass("secondary")} disabled={busy}>
					{t("Set allowance")}
				</button>
			</form>
		</Card>
	);
}
