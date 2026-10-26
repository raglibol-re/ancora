import { Fragment, useState } from "react";
import { buttonClass } from "../../ui/buttonClass.ts";
import { Card } from "../../ui/Card.tsx";
import { ExplorerLink } from "../../ui/ExplorerLink.tsx";
import { formatStroops } from "../../ui/format.ts";
import { type AdminHealth, type DueOrdersReport, refillXlm, runDueOrdersNow } from "./adminApi.ts";
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

type HealthPanelProps = {
	health: AdminHealth;
	busy: boolean;
	passphrase: string;
	onRefresh: () => void;
};

/** Everything the demo depends on, plus the one thing the operator can top up from here. */
export function HealthPanel({ health, busy, passphrase, onRefresh }: HealthPanelProps) {
	const { rpc, rent, contracts, operator, relayer } = health;
	const operatorOk = operator !== null && BigInt(operator.xlmStroops) >= MIN_XLM_FLOAT;
	const [refilling, setRefilling] = useState(false);
	const [refillError, setRefillError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [ordersReport, setOrdersReport] = useState<DueOrdersReport | string | null>(null);

	const runOrders = async () => {
		setRunning(true);
		setOrdersReport(null);
		try {
			setOrdersReport(await runDueOrdersNow(passphrase));
		} catch (failure) {
			setOrdersReport(failure instanceof Error ? failure.message : "The run failed.");
		} finally {
			setRunning(false);
		}
	};

	const refill = async () => {
		setRefilling(true);
		setRefillError(null);
		try {
			await refillXlm(passphrase);
			onRefresh();
		} catch (failure) {
			setRefillError(failure instanceof Error ? failure.message : "The top-up failed.");
		} finally {
			setRefilling(false);
		}
	};

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
							{operator.floats.map((float) => (
								<Fragment key={float.token}>
									<dt>Test money: {float.symbol}</dt>
									<dd>{formatStroops(float.stroops, float.symbol)}</dd>
								</Fragment>
							))}
						</dl>
					) : (
						<p className={styles.muted}>Not configured.</p>
					)}
					<p className={styles.muted}>
						Pays sponsored fees and sends test money. Not a signer on any organization account.
					</p>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy || refilling}
						onClick={refill}
					>
						{refilling ? "Asking Friendbot…" : "Top up XLM from Friendbot (~10,000)"}
					</button>
					<button
						type="button"
						className={buttonClass("secondary")}
						disabled={busy || running}
						onClick={runOrders}
					>
						{running ? "Running due standing orders…" : "Run due standing orders now"}
					</button>
					{typeof ordersReport === "string" && (
						<p className={styles.bad} role="alert">
							{ordersReport}
						</p>
					)}
					{ordersReport !== null && typeof ordersReport !== "string" && (
						<p className={styles.muted} role="status">
							{ordersReport.organizations} organizations visited, {ordersReport.due} due,{" "}
							{ordersReport.runs.filter((run) => run.hash).length} run,{" "}
							{ordersReport.runs.filter((run) => run.error).length} refused
							{ordersReport.unreadable > 0 && `, ${ordersReport.unreadable} on older code`}. The
							cron does the same every day at 07:00 UTC.
						</p>
					)}
					<p className={styles.muted}>
						BlendUSDC refills through <code>scripts/setup-testnet.sh</code> (Blend faucet); Circle
						USDC by hand at faucet.circle.com.
					</p>
					{refillError && (
						<p className={styles.bad} role="alert">
							{refillError}
						</p>
					)}
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
