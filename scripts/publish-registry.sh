#!/usr/bin/env bash
# Publishes ancora's contract Wasm files to the Stellar Registry (stellar-registry/contracts), so
# anyone can verify a deployed organization against a named, versioned release and, later, deploy
# organizations from the registry by name instead of from an operator-held hash.
#
# Usage:
#   scripts/publish-registry.sh            dry run (simulates every publish, changes nothing)
#   scripts/publish-registry.sh --publish  publish for real with the deployer key
#
# Requires the registry plugin for the Stellar CLI:
#   cargo binstall --locked stellar-registry-cli   (or: cargo install --locked stellar-registry-cli)
# The plugin reads STELLAR_NETWORK / STELLAR_RPC_URL / STELLAR_NETWORK_PASSPHRASE / STELLAR_ACCOUNT
# and STELLAR_REGISTRY_CONTRACT_ID to pick the registry; testnet is its default.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"
DEPLOYER="${DEPLOYER:-ancora-deployer}"
PUBLISH=false
[[ "${1:-}" == "--publish" ]] && PUBLISH=true

export STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
export STELLAR_ACCOUNT="${STELLAR_ACCOUNT:-$DEPLOYER}"

if ! command -v stellar >/dev/null; then
	windows_cli="/c/Program Files (x86)/Stellar CLI"
	[[ -x "$windows_cli/stellar.exe" ]] && PATH="$PATH:$windows_cli"
fi
command -v stellar >/dev/null || { echo "stellar CLI not found." >&2; exit 1; }
stellar registry --help >/dev/null 2>&1 || {
	echo "The registry plugin is missing: cargo binstall --locked stellar-registry-cli" >&2
	exit 1
}

(cd "$ROOT/contracts" && stellar contract build >/dev/null)

# Name on the registry, Wasm file, crate (for the version in Cargo.toml).
releases=(
	"ancora-organization ancora_organization organization"
	"ancora-registry ancora_registry registry"
	"ancora-recovery ancora_recovery recovery"
	"ancora-seal-verifier ancora_seal_verifier seal_verifier"
)

for release in "${releases[@]}"; do
	read -r name file crate <<<"$release"
	version="$(sed -n 's/^version = "\(.*\)"/\1/p' "$ROOT/contracts/Cargo.toml" | head -1)"
	wasm="$WASM_DIR/$file.wasm"
	[[ -f "$wasm" ]] || { echo "missing $wasm" >&2; exit 1; }
	args=(--wasm "$wasm" --wasm-name "$name" --binver "$version")
	$PUBLISH || args+=(--dry-run)
	echo "stellar registry publish ${args[*]} ($crate)"
	stellar registry publish "${args[@]}"
done

$PUBLISH && echo "Published. Browse: https://rgstry.xyz" || echo "Dry run only; add --publish to publish."
