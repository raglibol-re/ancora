#!/usr/bin/env node
// Checks the live ancora deployment the way a visitor depends on it and exits 1 when something
// is off, so the hourly GitHub Action fails and GitHub emails the team. No dependencies.
//
//   node scripts/check-live.mjs                      production
//   ANCORA_URL=https://… node scripts/check-live.mjs another deployment
//
// Fails on: the app or /api/health not answering, the testnet RPC unreachable, BlendUSDC test
// money empty (the stablecoin every demo starts with), the operator's XLM for sponsored fees
// below MIN_XLM. Warns only on: sample-data mode set in /admin (a deliberate choice), Circle
// USDC and EURC floats empty (refilled by hand at faucet.circle.com, see docs/ROADMAP.md).

const BASE_URL = process.env.ANCORA_URL ?? "https://ancora-gray.vercel.app";
const HORIZON = "https://horizon-testnet.stellar.org";
// The operator pays every sponsored fee; one passkey creation can cost up to 300 XLM of rent.
// Same floor as the health panel in /admin.
const OPERATOR = "GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3";
const MIN_XLM = 3_000;
const REQUIRED_TEST_MONEY = "BlendUSDC";

const problems = [];
const warnings = [];

async function fetchJson(url) {
	const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
	if (!response.ok) throw new Error(`${url} answered ${response.status}`);
	return response.json();
}

async function checkApp() {
	const response = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(20_000) });
	if (!response.ok) problems.push(`The app answered ${response.status} at ${BASE_URL}/.`);
}

async function checkHealth() {
	const health = await fetchJson(`${BASE_URL}/api/health`);
	if (!health.success) {
		problems.push(`/api/health reported an error: ${health.error?.message ?? "no message"}.`);
		return;
	}
	const { mode, rpc, testMoney } = health.data;
	if (mode !== "testnet") warnings.push(`The site is in "${mode}" mode (set in /admin).`);
	if (!rpc?.ok) problems.push(`The testnet RPC doesn't answer: ${rpc?.error ?? "no detail"}.`);
	for (const asset of testMoney ?? []) {
		if (asset.available) continue;
		const message = `The operator has no ${asset.symbol} test money left to hand out.`;
		if (asset.symbol === REQUIRED_TEST_MONEY) problems.push(message);
		else warnings.push(message);
	}
	if (!testMoney?.some((asset) => asset.symbol === REQUIRED_TEST_MONEY)) {
		problems.push(`/api/health lists no ${REQUIRED_TEST_MONEY} test money.`);
	}
}

async function checkOperatorXlm() {
	const account = await fetchJson(`${HORIZON}/accounts/${OPERATOR}`);
	const native = account.balances.find((balance) => balance.asset_type === "native");
	const xlm = Number(native?.balance ?? 0);
	if (xlm < MIN_XLM) {
		problems.push(
			`The operator holds ${xlm} XLM for sponsored fees, below ${MIN_XLM}: refill it with "Top up XLM from Friendbot" in /admin.`,
		);
	}
}

const checks = [checkApp, checkHealth, checkOperatorXlm];
const outcomes = await Promise.allSettled(checks.map((check) => check()));
outcomes.forEach((outcome, index) => {
	if (outcome.status === "rejected") {
		problems.push(`${checks[index]?.name} failed: ${outcome.reason?.message ?? outcome.reason}`);
	}
});

for (const warning of warnings) console.log(`::warning::${warning}`);
for (const problem of problems) console.log(`::error::${problem}`);
if (problems.length > 0) process.exit(1);
console.log(`ancora at ${BASE_URL} is healthy.`);
