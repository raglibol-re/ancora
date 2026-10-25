#!/usr/bin/env bash
# Prepares everything ancora needs on the Stellar testnet and writes the public IDs to
# app/.env.testnet. Safe to run repeatedly: the testnet is reset from time to time, so every
# step checks the current state first and only does what is missing.
#
#   scripts/setup-testnet.sh            set up / repair, then write app/.env.testnet
#   scripts/setup-testnet.sh --check    only verify, change nothing (exit 1 if something is off)
#   scripts/setup-testnet.sh --sync-vercel  also push the server settings and the deployer secret the
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
# Circle's testnet USDC and EURC (faucet.circle.com). Contract ids are derived below; the operator
# holds trustlines and small floats that have to be topped up by hand (the faucet is captcha-gated).
CIRCLE_USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
CIRCLE_EURC_ISSUER="GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO"
CIRCLE_USDC=""
CIRCLE_EURC=""
MIN_CIRCLE_FLOAT=200000000 # 20 units
BLEND_FAUCET="https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets"
# Keep at least this much BlendUSDC (in stroops, 7 decimals) on the deployer for demo top-ups.
MIN_USDC_FLOAT=3000000000 # 300 USDC (three test-money grants)

# DeFindex testnet deployments, from paltalabs/defindex public/testnet.contracts.json.
DEFINDEX_USDC_VAULT="CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN"
DEFINDEX_USDC_BLEND_STRATEGY="CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY"

# stellar/smart-account-kit v0.8.0 testnet deployments, from demo/.env.example.
KIT_ACCOUNT_WASM_HASH="1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a"
KIT_WEBAUTHN_VERIFIER="CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F"
KIT_ED25519_VERIFIER="CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4"
KIT_THRESHOLD_POLICY="CB3FATQKCIRIQOCYRUPCQ2KREQ7T4RPKS7EAEOZWPEPUKWEDRVROBCEG"
KIT_SPENDING_LIMIT_POLICY="CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G"
# Fee sponsoring goes through ancora's own Vercel Function, paid from the deployer's XLM.
RELAYER_URL="/api/relay"
# Keep at least this much XLM (in stroops) for sponsored fees. Testnet rent is escalated while its
# Soroban state is above target (~20–50 XLM per passkey transaction; see docs/DECISIONS.md).
MIN_XLM_FLOAT=30000000000 # 3,000 XLM
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

# Resolves a Circle asset's contract id, gives the operator a trustline and reports the float.
# Usage: circle_asset CODE ISSUER → prints the contract id.
circle_asset() {
	local code="$1" issuer="$2" contract balance
	contract="$(stellar contract id asset --asset "$code:$issuer" --network "$NETWORK" 2>/dev/null)" ||
		die "Could not derive the contract id of $code:$issuer."
	ok "$code contract $contract" >&2
	balance="$(curl -s "$HORIZON_URL/accounts/$DEPLOYER_ADDRESS" |
		python -I -c "import sys,json; print(next((b['balance'] for b in json.load(sys.stdin).get('balances',[]) if b.get('asset_code')=='$code' and b.get('asset_issuer')=='$issuer'), ''))" 2>/dev/null)"
	if [[ -z "$balance" ]]; then
		if $CHECK_ONLY; then
			problem "deployer has no trustline for $code:$issuer"
		else
			stellar tx new change-trust --source-account "$DEPLOYER" --network "$NETWORK" \
				--line "$code:$issuer" >/dev/null 2>&1 || die "Could not add the $code trustline."
		fi
		balance="0.0000000"
	fi
	local stroops=$((10#$(printf '%s' "$balance" | tr -d '.')))
	if ((stroops < MIN_CIRCLE_FLOAT)); then
		say "  ℹ deployer holds $balance Circle $code; top up by hand at https://faucet.circle.com (Stellar testnet) → $DEPLOYER_ADDRESS" >&2
	else
		ok "deployer holds $balance Circle $code" >&2
	fi
	printf '%s' "$contract"
}

ensure_circle_assets() {
	say "Circle USDC and EURC"
	CIRCLE_USDC="$(circle_asset USDC "$CIRCLE_USDC_ISSUER")"
	CIRCLE_EURC="$(circle_asset EURC "$CIRCLE_EURC_ISSUER")"
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
		refill_usdc_float
		balance="$(read_contract "$BLEND_USDC" balance --id "$DEPLOYER_ADDRESS" | tr -d '"')"
	fi
	ok "deployer holds $((balance / 10000000)) BlendUSDC"
}

# Blend's faucet pays each account once: it returns an issuer-signed transaction that adds the
# trustline and pays 1,000 USDC, which the receiver co-signs. To refill repeatedly, a throwaway
# Friendbot-funded key claims it and forwards everything to the deployer, then is deleted.
refill_usdc_float() {
	local helper helper_address envelope signed amount
	helper="ancora-float-$(date +%s)"
	stellar keys generate "$helper" --network "$NETWORK" --fund >/dev/null 2>&1 ||
		die "Friendbot could not fund a helper key. Try again later."
	helper_address="$(stellar keys address "$helper")"
	envelope="$(curl -fsS "$BLEND_FAUCET?userId=$helper_address" | tr -d '"')" ||
		die "Blend faucet unreachable. Try again later or claim manually at https://testnet.blend.capital"
	signed="$(stellar tx sign "$envelope" --sign-with-key "$helper" --network "$NETWORK" 2>/dev/null)"
	stellar tx send "$signed" --network "$NETWORK" >/dev/null 2>&1 || die "Blend faucet claim failed."
	amount="$(stellar contract invoke --id "$BLEND_USDC" --network "$NETWORK" --source "$helper" --send no 		-- balance --id "$helper_address" 2>/dev/null | tr -d '"')"
	stellar contract invoke --id "$BLEND_USDC" --network "$NETWORK" --source "$helper" 		-- transfer --from "$helper_address" --to "$DEPLOYER_ADDRESS" --amount "$amount" >/dev/null 2>&1 ||
		die "Could not forward the faucet USDC to the deployer."
	stellar keys rm "$helper" >/dev/null 2>&1 || true
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

# ancora's own contracts: the organization WASM (uploaded once per build; the operator deploys an
# instance per organization) and the registry (deployed once, id kept in app/.env.testnet).
ensure_ancora_contracts() {
	say "ancora contracts"
	local wasm_dir="$ROOT/contracts/target/wasm32v1-none/release"
	REGISTRY_CONTRACT="$(sed -n 's/^VITE_REGISTRY_CONTRACT=//p' "$ENV_FILE" 2>/dev/null | head -1)"
	SEAL_VERIFIER="$(sed -n 's/^VITE_SEAL_VERIFIER=//p' "$ENV_FILE" 2>/dev/null | head -1)"
	ORG_WASM_HASH="$(sed -n 's/^VITE_ORG_WASM_HASH=//p' "$ENV_FILE" 2>/dev/null | head -1)"
	if $CHECK_ONLY; then
		[[ -n "$ORG_WASM_HASH" ]] && ok "organization WASM $ORG_WASM_HASH" || problem "organization WASM hash missing"
		if [[ -n "$REGISTRY_CONTRACT" ]] && contract_exists "$REGISTRY_CONTRACT"; then
			ok "registry $REGISTRY_CONTRACT"
		else
			problem "registry contract missing (testnet reset?)"
		fi
		if [[ -n "$SEAL_VERIFIER" ]] && contract_exists "$SEAL_VERIFIER"; then
			ok "seal verifier $SEAL_VERIFIER"
		else
			problem "seal verifier missing (testnet reset?)"
		fi
		return
	fi
	(cd "$ROOT/contracts" && stellar contract build >/dev/null 2>&1) ||
		die "Contract build failed; run 'stellar contract build' in contracts/ to see why."
	ORG_WASM_HASH="$(stellar contract upload --wasm "$wasm_dir/ancora_organization.wasm" \
		--source "$DEPLOYER" --network "$NETWORK" 2>/dev/null)" || die "Could not upload the organization WASM."
	ok "organization WASM $ORG_WASM_HASH"
	if [[ -z "$REGISTRY_CONTRACT" ]] || ! contract_exists "$REGISTRY_CONTRACT"; then
		REGISTRY_CONTRACT="$(stellar contract deploy --wasm "$wasm_dir/ancora_registry.wasm" \
			--source "$DEPLOYER" --network "$NETWORK" -- --admin "$DEPLOYER_ADDRESS" 2>/dev/null)" ||
			die "Could not deploy the registry."
	fi
	ok "registry $REGISTRY_CONTRACT"
	# The ML-DSA-44 seal verifier is stateless; one instance serves every account.
	if [[ -z "$SEAL_VERIFIER" ]] || ! contract_exists "$SEAL_VERIFIER"; then
		SEAL_VERIFIER="$(stellar contract deploy --wasm "$wasm_dir/ancora_seal_verifier.wasm" \
			--source "$DEPLOYER" --network "$NETWORK" 2>/dev/null)" || die "Could not deploy the seal verifier."
	fi
	ok "seal verifier $SEAL_VERIFIER"
}

write_env_file() {
	$CHECK_ONLY && return
	cat >"$ENV_FILE" <<EOF
# Generated by scripts/setup-testnet.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Do not edit by hand.
# Public testnet addresses and IDs only; secrets never go here.

VITE_STELLAR_NETWORK=$NETWORK
VITE_STELLAR_RPC_URL=$RPC_URL
VITE_STELLAR_HORIZON_URL=$HORIZON_URL
VITE_STELLAR_NETWORK_PASSPHRASE=$PASSPHRASE

# Demo operator (top-ups, deployments). Not a signer on any organization account.
VITE_DEPLOYER_ADDRESS=$DEPLOYER_ADDRESS

# Assets and the Reserve. VITE_ORG_ASSETS lists what an organization may accept: Symbol:contract:currency[:vault].
VITE_USDC_TOKEN=$BLEND_USDC
VITE_ORG_ASSETS=BlendUSDC:$BLEND_USDC:USD:$DEFINDEX_USDC_VAULT,USDC:$CIRCLE_USDC:USD,EURC:$CIRCLE_EURC:EUR
VITE_NATIVE_TOKEN=$NATIVE_XLM_SAC
VITE_DEFINDEX_VAULT=$DEFINDEX_USDC_VAULT

# Smart accounts (stellar/smart-account-kit v0.8.0 testnet deployments)
VITE_ACCOUNT_WASM_HASH=$KIT_ACCOUNT_WASM_HASH
VITE_WEBAUTHN_VERIFIER=$KIT_WEBAUTHN_VERIFIER
VITE_ED25519_VERIFIER=$KIT_ED25519_VERIFIER
VITE_THRESHOLD_POLICY=$KIT_THRESHOLD_POLICY
VITE_SPENDING_LIMIT_POLICY=$KIT_SPENDING_LIMIT_POLICY
VITE_RELAYER_URL=$RELAYER_URL

# ancora contracts (built from contracts/)
VITE_REGISTRY_CONTRACT=$REGISTRY_CONTRACT
VITE_ORG_WASM_HASH=$ORG_WASM_HASH
VITE_SEAL_VERIFIER=$SEAL_VERIFIER
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

# The operator passphrase for /admin. Taken from $ADMIN_PASSPHRASE, else from app/.env.local
# (gitignored), else generated once and saved there. Never printed.
admin_passphrase() {
	local env_file="$ROOT/app/.env.local" value="${ADMIN_PASSPHRASE:-}"
	if [[ -z "$value" && -f "$env_file" ]]; then
		value="$(sed -n 's/^ADMIN_PASSPHRASE=//p' "$env_file" | head -1)"
	fi
	if [[ -z "$value" ]]; then
		value="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
		printf 'ADMIN_PASSPHRASE=%s\n' "$value" >>"$env_file"
		say "  ℹ New demo-admin passphrase saved to app/.env.local (gitignored)." >&2
	fi
	printf '%s' "$value"
}

sync_vercel() {
	$SYNC_VERCEL || return 0
	say "Vercel server settings"
	command -v vercel >/dev/null || die "vercel CLI is required for --sync-vercel."
	(
		cd "$ROOT"
		vercel_env STELLAR_RPC_URL "$RPC_URL"
		vercel_env STELLAR_NETWORK_PASSPHRASE "$PASSPHRASE"
		vercel_env ACCOUNT_WASM_HASH "$KIT_ACCOUNT_WASM_HASH"
		vercel_env USDC_TOKEN "$BLEND_USDC"
		vercel_env ORG_ASSETS "BlendUSDC:$BLEND_USDC:USD:$DEFINDEX_USDC_VAULT,USDC:$CIRCLE_USDC:USD,EURC:$CIRCLE_EURC:EUR"
		vercel_env ALLOWED_ORIGINS "$PRODUCTION_ORIGIN,http://localhost:5173,http://localhost:4173"
		vercel_env ORG_WASM_HASH "$ORG_WASM_HASH"
		vercel_env REGISTRY_CONTRACT "$REGISTRY_CONTRACT"
		vercel_env SEAL_VERIFIER "$SEAL_VERIFIER"
		vercel_env DEPLOYER_SECRET "$(stellar keys secret "$DEPLOYER")" secret
		vercel_env ADMIN_PASSPHRASE "$(admin_passphrase)" secret
		# Left over from the OpenZeppelin Channels relayer; the relayer now pays fees itself.
		vercel env rm RELAYER_API_KEY production --yes >/dev/null 2>&1 || true
		vercel env rm RELAYER_API_KEY preview --yes >/dev/null 2>&1 || true
	)
}

# The deployer pays sponsored fees. Friendbot funds each account once, so a throwaway funded key
# is merged into the deployer (handing over its ~10,000 XLM) whenever the float runs low.
ensure_xlm_float() {
	say "XLM float for sponsored fees"
	local stroops helper
	stroops="$(read_contract "$NATIVE_XLM_SAC" balance --id "$DEPLOYER_ADDRESS" | tr -d '"')"
	if [[ -z "$stroops" || "$stroops" -lt "$MIN_XLM_FLOAT" ]]; then
		$CHECK_ONLY && {
			problem "deployer holds ${stroops:-no} XLM stroops (want ≥ $MIN_XLM_FLOAT)"
			return
		}
		helper="ancora-xlm-$(date +%s)"
		stellar keys generate "$helper" --network "$NETWORK" --fund >/dev/null 2>&1 ||
			die "Friendbot could not fund a helper key. Try again later."
		stellar tx new account-merge --source-account "$helper" --account "$DEPLOYER_ADDRESS" \
			--network "$NETWORK" >/dev/null 2>&1 || die "Could not merge the helper into the deployer."
		stellar keys rm "$helper" >/dev/null 2>&1 || true
		stroops="$(read_contract "$NATIVE_XLM_SAC" balance --id "$DEPLOYER_ADDRESS" | tr -d '"')"
	fi
	ok "deployer holds $((stroops / 10000000)) XLM"
}

main() {
	say "ancora testnet setup$($CHECK_ONLY && printf ' (check only)')"
	require_tools
	ensure_deployer
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && ensure_xlm_float
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && ensure_usdc_float
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && ensure_circle_assets
	verify_external_contracts
	[[ -n "${DEPLOYER_ADDRESS:-}" ]] && ensure_ancora_contracts
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
