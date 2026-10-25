import { type FormEvent, useState } from "react";
import { assetInUse, balanceOf, type OrgAccount } from "../../domain/account.ts";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { controlClass, Field } from "../../ui/Field.tsx";
import { formatMoney } from "../../ui/format.ts";
import { useWorkspace } from "../workspace/WorkspaceContext.ts";
import styles from "./PeopleCard.module.css";
import { useProposeChange } from "./useProposeChange.ts";

/**
 * The stablecoins the organization accepts. Adding or dropping one is a governance change like
 * any rule change; an asset with money or open requests on it can't be dropped.
 */
export function AssetsCard({ account }: { account: OrgAccount }) {
	const { dataSource } = useWorkspace();
	const { propose, busy } = useProposeChange(account);
	const { org } = account;
	const options = dataSource.availableAssets.filter(
		(option) => !org.assets.some((a) => a.token === option.token),
	);
	const [choice, setChoice] = useState(options[0]?.token ?? "");
	const selected = options.find((o) => o.token === choice) ?? options[0];

	const add = async (event: FormEvent) => {
		event.preventDefault();
		if (!selected) return;
		const { token, symbol, currency, vault } = selected;
		const result = await propose({ type: "addAsset", asset: { token, symbol, currency, vault } });
		if (result?.ok) setChoice("");
	};

	return (
		<Card title="Accepted assets">
			<p className={styles.you}>
				Rules are in {org.baseCurrency}. Payments in an asset of another currency take the strictest
				tier until a live exchange rate is connected.
			</p>
			<ul className={styles.list}>
				{org.assets.map((asset) => {
					const { balance, reserve } = balanceOf(account, asset.token);
					const inUse = assetInUse(account, asset.token);
					return (
						<li key={asset.token} className={styles.person}>
							<span className={styles.name}>
								{asset.symbol} ({asset.currency}){asset.vault ? " · earns in a Reserve" : ""}
								<span className={styles.id}>{asset.token}</span>
							</span>
							<span className={styles.you}>
								{formatMoney(balance, asset.currency)}
								{reserve > 0 && ` + ${formatMoney(reserve, asset.currency)} in the Reserve`}
							</span>
							<button
								type="button"
								className={buttonClass("secondary")}
								disabled={busy || inUse || org.assets.length === 1}
								title={
									inUse
										? "Still holds money or has open requests"
										: org.assets.length === 1
											? "An organization needs at least one asset"
											: undefined
								}
								onClick={() => propose({ type: "removeAsset", token: asset.token })}
							>
								Stop accepting
							</button>
						</li>
					);
				})}
			</ul>
			{options.length > 0 && (
				<form className={styles.invite} onSubmit={add}>
					<Field label="Accept another asset" htmlFor="asset-choice">
						<select
							id="asset-choice"
							className={controlClass}
							value={selected?.token ?? ""}
							onChange={(e) => setChoice(e.target.value)}
						>
							{options.map((option) => (
								<option key={option.token} value={option.token}>
									{option.label}
								</option>
							))}
						</select>
					</Field>
					<button type="submit" className={buttonClass()} disabled={busy || !selected}>
						Accept
					</button>
				</form>
			)}
		</Card>
	);
}
