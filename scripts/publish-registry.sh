#!/usr/bin/env bash
# Publishes ancora's contract Wasm files to the Stellar Registry (stellar-registry/contracts), so
# anyone can verify a deployed organization against a named, versioned release, and organizations
# can move to a new release of their code through their own rules (`Change::Upgrade` accepts only
# the latest `ancora-organization` hash the registry names).
#
# Usage:
#   scripts/publish-registry.sh            dry run (simulates every publish, changes nothing)
#   scripts/publish-registry.sh --publish  publish for real with the deployer key
#
# Talks to the registry's open channel (VITE_STELLAR_REGISTRY_CONTRACT in app/.env.testnet, which
# scripts/setup-testnet.sh resolves) through the plain Stellar CLI: `publish_hash` for the Wasm the
# CLI uploaded, versioned with the contracts workspace version. A release whose hash is already the
# latest under its name is skipped, so the script is safe to run after every build. On the open
# channel the first publisher of a name becomes its author; only the author publishes again.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"
ENV_FILE="$ROOT/app/.env.testnet"
DEPLOYER="${DEPLOYER:-ancora-deployer}"
NETWORK="${STELLAR_NETWORK:-testnet}"
PUBLISH=false
[[ "${1:-}" == "--publish" ]] && PUBLISH=true

if ! command -v stellar >/dev/null; then
	windows_cli="/c/Program Files (x86)/Stellar CLI"
	[[ -x "$windows_cli/stellar.exe" ]] && PATH="$PATH:$windows_cli"
fi
command -v stellar >/dev/null || { echo "stellar CLI not found." >&2; exit 1; }

REGISTRY="$(sed -n 's/^VITE_STELLAR_REGISTRY_CONTRACT=//p' "$ENV_FILE" 2>/dev/null | head -1)"
[[ "$REGISTRY" == C* ]] || { echo "No registry channel in $ENV_FILE; run scripts/setup-testnet.sh." >&2; exit 1; }
AUTHOR="$(stellar keys address "$DEPLOYER")"
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' "$ROOT/contracts/Cargo.toml" | head -1)"

(cd "$ROOT/contracts" && stellar contract build >/dev/null)

registry() {
	stellar contract invoke --id "$REGISTRY" --source "$DEPLOYER" --network "$NETWORK" "$@"
}

# Name on the registry and Wasm file.
releases=(
	"ancora-organization ancora_organization"
	"ancora-registry ancora_registry"
	"ancora-recovery ancora_recovery"
	"ancora-seal-verifier ancora_seal_verifier"
)

echo "Registry channel $REGISTRY, author $AUTHOR, version $VERSION"
for release in "${releases[@]}"; do
	read -r name file <<<"$release"
	wasm="$WASM_DIR/$file.wasm"
	[[ -f "$wasm" ]] || { echo "missing $wasm" >&2; exit 1; }
	hash="$(sha256sum "$wasm" | cut -d' ' -f1)"
	# Nothing published yet under the name makes fetch_hash fail; that reads as "no release".
	latest="$(registry --send=no -- fetch_hash --wasm_name "$name" 2>/dev/null | tr -d '"' || true)"
	if [[ "$latest" == "$hash" ]]; then
		echo "  ✓ $name: $hash is already the latest release"
		continue
	fi
	if $PUBLISH; then
		stellar contract upload --wasm "$wasm" --source "$DEPLOYER" --network "$NETWORK" >/dev/null
		registry -- publish_hash --wasm_name "$name" --author "$AUTHOR" --wasm_hash "$hash" \
			--version "$VERSION" >/dev/null
		echo "  ✓ $name $VERSION published: $hash"
	else
		registry --send=no -- publish_hash --wasm_name "$name" --author "$AUTHOR" --wasm_hash "$hash" \
			--version "$VERSION" >/dev/null
		echo "  ✓ $name $VERSION would be published: $hash (simulated)"
	fi
done

$PUBLISH || echo "Dry run only; add --publish to publish."
