import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatStroops } from "../../ui/format.ts";
import type { AdminHealth } from "./adminApi.ts";
import styles from "./HealthPanel.module.css";

const MIN_XLM_FLOAT = 3_000n * 10_000_000n;
const gb = (bytes: number) => (bytes / 1e9).toFixed(2);

function Status({ ok, label }: { ok: boolean; label?: string }) {
	return (
		<span className={`${styles.status} ${ok ? styles.ok : styles.bad}`}>
			{label ?? (ok ? "OK" : "Problem")}
		</span>
	);
}

type HealthPanelProps = { health: AdminHealth; busy: boolean; onRefresh: () => void };

/** Read-only view of everything the demo depends on. */
export function HealthPanel({ health, busy, onRefresh }: HealthPanelProps) {
	const { rpc, rent, contracts, operator, relayer } = health;
	const operatorOk = operator !== null && BigInt(operator.xlmStroops) >= MIN_XLM_FLOAT;

	return (
		<>
			<div className={styles.grid}>
				<Card title="Stellar RPC" action={<Status ok={rpc.ok} />}>
					<dl className={styles.list}>
						<dt>Endpoint</dt>
						<dd>{relayer.rpcUrl}</dd>
						<dt>Latest ledger</dt>
						<dd>{rpc.ledger ?? "—"}</dd>
						<dt>Protocol</dt>
						<dd>{rpc.protocol ?? "—"}</dd>
						<dt>Latency</dt>
						<dd>{rpc.latencyMs} ms</dd>
					</dl>
				</Card>

				<Card
					title="Testnet rent"
					action={
						rent && <Status ok={!rent.escalated} label={rent.escalated ? "Escalated" : "Normal"} />
					}
				>
					{rent ? (
						<p>
							Live Soroban state {gb(rent.stateBytes)} GB of a {gb(rent.targetBytes)} GB target, so
							rent is {rent.ratePerKb.toLocaleString("en-IE")} stroops/KB (mainnet today: 1,000).
							{rent.escalated &&
								" Expect ~20–50 XLM per passkey transaction; the operator sponsors it."}
						</p>
					) : (
						<p className={styles.muted}>Couldn't read the fee configuration.</p>
					)}
				</Card>

				<Card title="Demo operator" action={operator && <Status ok={operatorOk} />}>
					{operator ? (
						<dl className={styles.list}>
							<dt>Account</dt>
							<dd>
								<ExplorerLink target={operator.address}>{operator.address}</ExplorerLink>
							</dd>
							<dt>XLM for fees</dt>
							<dd>{formatStroops(operator.xlmStroops, "XLM")}</dd>
							<dt>Test USDC</dt>
							<dd>{formatStroops(operator.usdcStroops, "USDC")}</dd>
						</dl>
					) : (
						<p className={styles.muted}>Not configured.</p>
					)}
					<p className={styles.muted}>
						Pays sponsored fees and sends test money. Not a signer on any organization account.
						Refill: <code>scripts/setup-testnet.sh</code>.
					</p>
				</Card>

				<Card title="Relayer">
					<dl className={styles.list}>
						<dt>Endpoint</dt>
						<dd>/api/relay (sponsored by the operator)</dd>
						<dt>Allowed origins</dt>
						<dd>{relayer.allowedOrigins.join(", ")}</dd>
					</dl>
				</Card>
			</div>

			<Card
				title="Contracts this build uses"
				action={<Status ok={contracts.length > 0 && contracts.every((c) => c.ok)} />}
			>
				{contracts.length === 0 ? (
					<p className={styles.muted}>This build has no testnet configuration.</p>
				) : (
					<ul className={styles.contracts}>
						{contracts.map((contract) => (
							<li key={contract.id}>
								<Status ok={contract.ok} label={contract.ok ? "Found" : "Missing"} />
								<span>{contract.label}</span>
								<ExplorerLink target={contract.id}>{contract.id}</ExplorerLink>
							</li>
						))}
					</ul>
				)}
			</Card>

			<button
				type="button"
				className={buttonClass("secondary")}
				onClick={onRefresh}
				disabled={busy}
			>
				{busy ? "Checking…" : "Check again"}
			</button>
		</>
	);
}
