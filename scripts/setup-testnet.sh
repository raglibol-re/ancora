#!/usr/bin/env bash
# Prepares everything ancora needs on the Stellar testnet and writes the public IDs to
# app/.env.testnet. Safe to run repeatedly: the testnet is reset from time to time, so every
# step checks the current state first and only does what is missing.
#
#   scripts/setup-testnet.sh            set up / repair, then write app/.env.testnet
#   scripts/setup-testnet.sh --check    only verify, change nothing (exit 1 if something is off)
#   scripts/setup-testnet.sh --sync-vercel  also push the server settings and secrets the
#                                       Vercel Functions need (relayer, test money) to the project
#
# Requires: stellar CLI (28.x), curl. Secret keys stay in the stellar CLI keystore
# (~/.config/stellar); app/.env.testnet only ever contains public addresses and IDs.

set -euo pipefail

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
HORIZON_URL="https://horizon-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"
DEPLOYER="ancora-deployer"

# BlendUSDC: Stellar Asset Contract of USDC:GATALT… issued by Blend's testnet faucet (7 decimals).
BLEND_USDC="CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"
BLEND_FAUCET="https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets"
# Keep at least this much BlendUSDC (in stroops, 7 decimals) on the deployer for demo top-ups.
MIN_USDC_FLOAT=2000000000 # 200 USDC

# DeFindex testnet deployments, from paltalabs/defindex public/testnet.contracts.json.
DEFINDEX_USDC_VAULT="CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN"
DEFINDEX_USDC_BLEND_STRATEGY="CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY"

# stellar/smart-account-kit v0.8.0 testnet deployments, from demo/.env.example.
KIT_ACCOUNT_WASM_HASH="1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a"
KIT_WEBAUTHN_VERIFIER="CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F"
KIT_ED25519_VERIFIER="CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4"
KIT_THRESHOLD_POLICY="CB3FATQKCIRIQOCYRUPCQ2KREQ7T4RPKS7EAEOZWPEPUKWEDRVROBCEG"
KIT_SPENDING_LIMIT_POLICY="CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G"
# Fee sponsoring goes through ancora's own Vercel Function (OZ Relayer Channels behind it).
RELAYER_URL="/api/relay"
CHANNELS_GEN_URL="https://channels.openzeppelin.com/testnet/gen"
PRODUCTION_ORIGIN="https://ancora-gray.vercel.app"
NATIVE_XLM_SAC="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/app/.env.testnet"
CHECK_ONLY=false
SYNC_VERCEL=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true
[[ "${1:-}" == "--sync-vercel" ]] && SYNC_VERCEL=true
PROBLEMS=0

say() { printf '%s\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
problem() {
	printf '  ✗ %s\n' "$*" >&2
	PROBLEMS=$((PROBLEMS + 1))
}
die() {
	printf 'error: %s\n' "$*" >&2
	exit 1
}

# Read-only contract call; prints the result, empty on failure.
read_contract() {
	local id="$1"
	shift
	stellar contract invoke --id "$id" --network "$NETWORK" --source "$DEPLOYER" --send no -- "$@" 2>/dev/null || true
}

contract_exists() {
	stellar contract info interface --id "$1" --network "$NETWORK" >/dev/null 2>&1
}

account_exists() {
	[[ "$(curl -s -o /dev/null -w '%{http_code}' "$HORIZON_URL/accounts/$1")" == "200" ]]
}

require_tools() {
	command -v curl >/dev/null || die "curl is required."
	if ! command -v stellar >/dev/null; then
		# Default install location of the Windows installer / winget package.
		local windows_cli="/c/Program Files (x86)/Stellar CLI"
		[[ -x "$windows_cli/stellar.exe" ]] && PATH="$PATH:$windows_cli"
	fi
	command -v stellar >/dev/null ||
		die "stellar CLI not found. Install it: https://developers.stellar.org/docs/tools/cli/install-cli"
	ok "$(stellar --version | head -1)"
}

ensure_deployer() {
	say "Deployer key ($DEPLOYER)"
	if ! stellar keys address "$DEPLOYER" >/dev/null 2>&1; then
		$CHECK_ONLY && {
			problem "key $DEPLOYER does not exist"
			return
		}
		stellar keys generate "$DEPLOYER" --network "$NETWORK" --fund >/dev/null
	fi
	DEPLOYER_ADDRESS="$(stellar keys address "$DEPLOYER")"
	if ! account_exists "$DEPLOYER_ADDRESS"; then
		# The key survives a testnet reset, the account doesn't.
		$CHECK_ONLY && {
			problem "account $DEPLOYER_ADDRESS is not funded (testnet reset?)"
			return
		}
		stellar keys fund "$DEPLOYER" --network "$NETWORK" >/dev/null
	fi
	ok "$DEPLOYER_ADDRESS funded with XLM"
}

ensure_usdc_float() {
	say "BlendUSDC float"
	local balance
	balance="$(read_contract "$BLEND_USDC" balance --id "$DEPLOYER_ADDRESS" | tr -d '"')"
	if [[ -z "$balance" || "$balance" -lt "$MIN_USDC_FLOAT" ]]; then
		$CHECK_ONLY && {
			problem "deployer holds ${balance:-no} BlendUSDC stroops (want ≥ $MIN_USDC_FLOAT)"
			return
		}
		# The faucet returns a transaction pre-signed by the issuer that adds the trustline and pays
		# 1,000 USDC; the receiving account co-signs and submits it.
		local envelope signed
		envelope="$(curl -fsS "$BLEND_FAUCET?userId=$DEPLOYER_ADDRESS" | tr -d '"')" ||
			die "Blend faucet unreachable. Try again later or claim manually at https://testnet.blend.capital"
		signed="$(stellar tx sign "$envelope" --sign-with-key "$DEPLOYER" --network "$NETWORK" 2>/dev/null)"
		stellar tx send "$signed" --network "$NETWORK" >/dev/null
		balance="$(read_contract "$BLEND_USDC" balance --id "$DEPLOYER_ADDRESS" | tr -d '"')"
	fi
	ok "deployer holds $((balance / 10000000)) BlendUSDC"
}

verify_external_contracts() {
	say "External contracts"
	local name id
	for entry in \
		"BlendUSDC:$BLEND_USDC" \
		"DeFindex USDC vault:$DEFINDEX_USDC_VAULT" \
		"DeFindex Blend strategy:$DEFINDEX_USDC_BLEND_STRATEGY" \
		"WebAuthn verifier:$KIT_WEBAUTHN_VERIFIER" \
		"Ed25519 verifier:$KIT_ED25519_VERIFIER" \
		"Threshold policy:$KIT_THRESHOLD_POLICY" \
		"Spending-limit policy:$KIT_SPENDING_LIMIT_POLICY" \
		"Native XLM token:$NATIVE_XLM_SAC"; do
		name="${entry%%:*}"
		id="${entry#*:}"
		if contract_exists "$id"; then ok "$name $id"; else problem "$name $id not found on testnet"; fi
	done
	# The Reserve depends on the vault holding exactly BlendUSDC.
	if read_contract "$DEFINDEX_USDC_VAULT" get_assets | grep -q "$BLEND_USDC"; then
		ok "DeFindex vault asset is BlendUSDC"
	else
		problem "DeFindex vault does not report BlendUSDC as its asset"
	fi
}

write_env_file() {
	$CHECK_ONLY && return
	cat >"$ENV_FILE" <<EOF
# Generated by scripts/setup-testnet.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Do not edit by hand.
# Public testnet addresses and IDs only; secrets never go here.

VITE_STELLAR_NETWORK=$NETWORK
VITE_STELLAR_RPC_URL=$RPC_URL
VITE_STELLAR_NETWORK_PASSPHRASE=$PASSPHRASE

# Demo operator (top-ups, deployments). Not a signer on any organization account.
VITE_DEPLOYER_ADDRESS=$DEPLOYER_ADDRESS

# Assets and the Reserve
VITE_USDC_TOKEN=$BLEND_USDC
VITE_NATIVE_TOKEN=$NATIVE_XLM_SAC
VITE_DEFINDEX_VAULT=$DEFINDEX_USDC_VAULT

# Smart accounts (stellar/smart-account-kit v0.8.0 testnet deployments)
VITE_ACCOUNT_WASM_HASH=$KIT_ACCOUNT_WASM_HASH
VITE_WEBAUTHN_VERIFIER=$KIT_WEBAUTHN_VERIFIER
VITE_ED25519_VERIFIER=$KIT_ED25519_VERIFIER
VITE_THRESHOLD_POLICY=$KIT_THRESHOLD_POLICY
VITE_SPENDING_LIMIT_POLICY=$KIT_SPENDING_LIMIT_POLICY
VITE_RELAYER_URL=$RELAYER_URL
EOF
	ok "wrote ${ENV_FILE#"$ROOT/"}"
}

# Replaces one Vercel environment variable in all environments; values go through stdin so
# secrets never appear in the process list or the terminal.
# Public settings go to every environment as Config; secrets (third argument "secret") only to
# production and preview as Sensitive, which Vercel never shows again and keeps out of development.
vercel_env() {
	local name="$1" value="$2" kind="${3:-config}" target targets=(production preview development)
	local flag="--no-sensitive"
	if [[ "$kind" == "secret" ]]; then
		flag="--sensitive"
		targets=(production preview)
	fi
	for target in production preview development; do
		vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
	done
	for target in "${targets[@]}"; do
		printf '%s' "$value" | vercel env add "$name" "$target" "$flag" >/dev/null 2>&1 ||
			die "Could not set $name on Vercel ($target)."
	done
	ok "Vercel env $name ($kind)"
}

sync_vercel() {
	$SYNC_VERCEL || return 0
	say "Vercel server settings"
	command -v vercel >/dev/null || die "vercel CLI is required for --sync-vercel."
	local api_key
	api_key="$(curl -fsS "$CHANNELS_GEN_URL" | sed -n 's/.*"apiKey" *: *"\([^"]*\)".*/\1/p')"
	[[ -n "$api_key" ]] || die "Could not mint an OpenZeppelin Channels API key."
	(
		cd "$ROOT"
		vercel_env STELLAR_RPC_URL "$RPC_URL"
		vercel_env STELLAR_NETWORK_PASSPHRASE "$PASSPHRASE"
		vercel_env ACCOUNT_WASM_HASH "$KIT_ACCOUNT_WASM_HASH"
		vercel_env USDC_TOKEN "$BLEND_USDC"
		vercel_env ALLOWED_ORIGINS "$PRODUCTION_ORIGIN,http://localhost:5173,http://localhost:4173"
		vercel_env RELAYER_API_KEY "$api_key" secret
		vercel_env DEPLOYER_SECRET "$(stellar keys secret "$DEPLOYER")" secret
	)
}

main() {
	say "ancora testnet setup$($CHECK_ONLY && printf ' (check only)')"
	require_tools
	ensure_deployer
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && ensure_usdc_float
	verify_external_contracts
	# ancora's own contracts are deployed here as they land (approval policy and requests: task 6,
	# Reserve split: task 7, seal verifier: task 8, org registry: task 11). See docs/ROADMAP.md.
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && write_env_file
	sync_vercel
	if ((PROBLEMS > 0)); then
		die "$PROBLEMS problem(s) found."
	fi
	say "Testnet is ready."
}

main
