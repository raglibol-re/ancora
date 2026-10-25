# CLAUDE.md: working rules for ancora

## Product
- Name: always **ancora**: lowercase, plain "a", no accent, also at sentence start, in UI, README, manifest. Never "Ancora", "ANCORA", "Âncora".
- ancora is a programmable stablecoin business account for organizations (clubs, companies, NGOs, teams) on Stellar. Neobank UX, Stellar in the background. Orgs set rules; the account enforces them.
- HackMeridian 2026, Genesis path, both tracks. **Hard deadline: Mon 26 Oct 2026, 12:00 Lisbon (UTC+0).** Then SCF #46 (8 Nov 2026), so code and docs must be build-on-able.
- Testnet only. Non-custodial: neither the platform nor the demo admin ever controls org funds. Fiat/KYB is the licensed partner's job.
- Legal wording: not a bank; no "interest" / "savings account"; balances not deposit-insured. Use "account", "Reserve", "earnings, variable".
- Everything simulated is labeled "Simulated" in UI and README. UI copy in English, plain language, no crypto jargon (expert mode shows on-chain refs).
- Accessible: keyboard focus, contrast, `prefers-reduced-motion`.

## Layout
- `app/`: Vite + React + TS PWA **and** Vercel Functions (`app/api/`). Vercel Root Directory = `app`. One Vercel project serves `/`, `/app/*`, `/admin`, `/api/*`.
- `contracts/`: Rust Soroban workspace, one crate per contract, shared test vectors in one place.
- `scripts/`: testnet setup and ops. `docs/`: ROADMAP, ARCHITECTURE, DECISIONS. `design/`: Claude Design package (when it arrives).
- `app/src` layering (strict):
  - `domain/`: pure logic (rules engine, money, request lifecycle). No React, network, or Stellar SDK. Fully unit-tested.
  - `adapters/`: the only code touching the outside world (RPC, smart-account-kit, DeFindex, ramps, Blob), each behind an interface defined next to the domain. Sample-data and testnet implementations are interchangeable; the sample adapter stays as demo fallback.
  - `features/<name>/`: UI per feature with its components, hooks, styles.
  - `ui/`: shared presentational components only.
  - `styles/tokens.css`: the **only** place for colors, fonts, radii, spacing, shadows (light + dark via `light-dark()`). Components use tokens only.
  - Brand assets only in `app/public/brand/`; regenerate PNGs with `pnpm icons` after editing `mark.svg`.
- No barrel files, no `utils` dumping ground; name modules by what they do.

## Code rules
- TS strict, `noUncheckedIndexedAccess`, no `any`, no non-null assertions without an explaining comment. Biome is the only formatter/linter; zero warnings.
- Money = integer minor units everywhere, never floats; format only at the UI edge.
- Errors: typed results or explicit error classes; user-facing messages say what happened and how to fix it. No silent catches.
- Files past ~250 lines get split. Small functions, intent-revealing names, comments explain *why*.
- No dead code, commented-out code, `console.log`, or TODO without a `docs/ROADMAP.md`/issue reference. Delete mocks once real code replaces them (except the sample-data adapter).
- Dependencies: minimal, exact versions (`.npmrc save-exact`). Remove unused ones immediately.
- Rust: `cargo fmt`, `cargo clippy -- -D warnings`; no unwrap/expect in contract code; `#[contracterror]` errors; every public fn has a doc comment, an auth note, and tests incl. a strict-auth test without `mock_all_auths`.
- Never guess APIs: check official docs/source (developers.stellar.org, OpenZeppelin/stellar-contracts, stellar/smart-account-kit, paltalabs/defindex, apidocs.bridge.xyz, vercel.com/docs). Pinned: smart-account-kit 0.8.x, @stellar/stellar-sdk 16.3.x (not 17), OZ stellar-contracts 0.8.0 → soroban-sdk 28.
- Default: no database. Anything stored off-chain needs a justification in `docs/DECISIONS.md`.

## Workflow
- Before every push: `cd app && pnpm verify` (biome ci, tsc, vitest, build) and, once crates exist, `cd contracts && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.
- Small conventional commits (`feat(rules): …`, `fix(pay): …`); never mix refactor and feature. Push to `main` after each meaningful step; Vercel deploys production from `main`. Confirm the deploy and live site after each push; a red CI blocks feature work.
- Secrets only in Vercel env vars / gitignored `.env*` files; `app/.env.example` documents them. `VITE_*` vars are public.
- **Frontend follows backend:** every technical change (engine, adapter, contract, relayer) ships with its UI in the same task: new states, errors, labels, expert-mode references, Simulated/Real tags.
- Update docs in the same commit as the feature: README (feature status table), `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `CHANGELOG.md`.
- Self-review the diff before committing (dead code, duplication, names).
- After each task: report what's real, simulated, unverified, and the live URL.
- Blocked > 30 min → stop and report options.
