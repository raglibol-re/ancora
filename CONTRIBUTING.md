# Contributing to ancora

How the code is organized and the rules every change follows. Operations, accounts and open work are in [docs/HANDOFF.md](docs/HANDOFF.md).

## Setup

Requirements: Node 24, pnpm 10. For contracts: the Rust toolchain pinned in `contracts/rust-toolchain.toml` (with the `wasm32v1-none` target) and the Stellar CLI 28.x.

```bash
cd app
pnpm install
cp .env.example .env.local   # fill in what you need; every variable is documented there
pnpm dev                     # http://localhost:5173, sample data unless the testnet is configured
pnpm verify                  # Biome, TypeScript, Vitest, build: what CI runs
```

```bash
cd contracts
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Layout

- `app/`: the Vite + React + TypeScript PWA and the Vercel Functions (`app/api/`). One Vercel project serves `/`, `/app/*`, `/admin` and `/api/*`.
- `contracts/`: the Soroban workspace, one crate per contract; shared test vectors in `contracts/test-vectors/`.
- `scripts/`: testnet setup, contract publishing, the live check.
- `docs/`: architecture, decisions, roadmap, the maintainer handbook. `design/` holds the brand source files (not shipped).

Inside `app/src`, the layering is strict:

| Folder | Holds | May not |
|---|---|---|
| `domain/` | pure logic: rules engine, money, request lifecycle | import React, the network or the Stellar SDK |
| `adapters/` | everything that talks to the outside world, each behind an interface defined next to the domain | be imported by `domain/` |
| `features/<name>/` | screens with their components, hooks and styles | talk to the network except through a data source |
| `ui/` | shared presentational components | hold feature logic |

The sample-data adapter and the testnet adapter are interchangeable; the sample one stays as the labelled fallback. Colours, fonts, radii, spacing and shadows live only in `app/src/styles/tokens.css` (light and dark through `light-dark()`); brass text uses `--color-accent-text`, `--color-accent` is for lines and marks. Brand assets are the exports in `app/public/brand/`, used as they are.

No barrel files and no catch-all `utils` module: name a module after what it does.

## Code rules

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`; no non-null assertion without a comment explaining why it holds.
- Biome is the only formatter and linter, with zero warnings.
- Money is integer minor units everywhere; format only at the UI edge.
- Errors are typed results or explicit error classes. A message a person sees says what happened and how to fix it. No silent catches.
- Files past about 250 lines get split. Small functions, names that say what they do, comments that explain why.
- No dead or commented-out code, no `console.log`, no TODO without a ROADMAP or issue reference. Remove a mock once real code replaces it (the sample adapter is not a mock).
- Dependencies are minimal and pinned to exact versions (`.npmrc` has `save-exact`). Remove unused ones right away.
- Never guess an external API: check its official documentation or source. Pinned: smart-account-kit 0.8.x, `@stellar/stellar-sdk` 16.4.x, OpenZeppelin stellar-contracts 0.8.0 with soroban-sdk 28.
- Rust: `cargo fmt`, `cargo clippy -- -D warnings`, no `unwrap`/`expect` in contract code, errors as `#[contracterror]`. Every public function has a doc comment, a note on who must authorize it, and tests, including one with strict authorization (no `mock_all_auths`).

## Product rules

- The name is **ancora**: lowercase, everywhere, also at the start of a sentence.
- Testnet only, and non-custodial: neither the platform nor the operator ever controls an organization's funds.
- Legal wording: ancora is not a bank; no "interest" or "savings account"; balances are not deposit-insured. Say "account", "Reserve", "earnings, variable".
- Anything simulated is labelled *Simulated* in the UI and in the README.
- Copy is plain language without crypto jargon (expert mode shows on-chain references), in English and German. Wrap UI text in `t()` from `ui/i18n.ts` with the English text as the key, and add the German (formal "Sie") to `ui/messages/de.ts`; `ui/i18n.test.ts` fails on a missing translation.
- Accessible: keyboard focus, contrast, `prefers-reduced-motion`.
- Stellar is the source of truth. The few off-chain records live in the Neon database (`app/db/schema.sql`, through `app/api/_lib/database.ts`); anything new stored off-chain needs an entry in `docs/DECISIONS.md`.
- A technical change ships with its UI in the same change: new states, errors, labels, expert-mode references, Simulated or Real tags.

## Workflow

- Small conventional commits (`feat(rules): …`, `fix(pay): …`, `test(e2e): …`); never mix a refactor and a feature in one commit.
- Update the docs in the same commit as the change: README (feature status), `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `CHANGELOG.md`.
- Before pushing: `cd app && pnpm verify` must exit 0, plus the contract checks when `contracts/` changed. Review your own diff for dead code, duplication and names.
- `main` deploys to production. After a push, confirm the Vercel commit status and the live site; a red CI blocks feature work.
- Secrets only in Vercel environment variables, GitHub secrets or gitignored `.env*` files. `VITE_*` variables are public.

## Development environment notes

- **Windows:** scripts that rewrite files must keep LF line endings (in Python, open with `newline=''`), or Biome fails; `npx biome check --write <files>` repairs it.
- **Playwright locally** uses the installed Microsoft Edge (`channel: "msedge"`); CI installs Chromium. For screenshots of a local build, run `npx vite preview --port 4317`. The API functions don't run under `vite preview`, so flows that need the server are tested against production.
- **Stellar CLI on Windows** installs to `C:\Program Files (x86)\Stellar CLI`, which may not be on `PATH`.
