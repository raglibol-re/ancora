# Maintainer handbook

What someone taking over ancora needs beyond the code: where it runs, how it is operated, how it is tested, and what is open. Read it after [CONTRIBUTING.md](../CONTRIBUTING.md) (working rules) and before [ROADMAP.md](ROADMAP.md). Design is in [ARCHITECTURE.md](ARCHITECTURE.md), the reasons behind it in [DECISIONS.md](DECISIONS.md), the history in [CHANGELOG.md](../CHANGELOG.md).

State as of 15 Nov 2026.

## Current state

- **Live:** https://ancora-gray.vercel.app, public preview on the Stellar testnet (protocol 30). Every feature in the README table marked *Real on testnet* runs on ancora's contracts with test money; sample data is the labelled fallback when the testnet or ancora's server doesn't answer.
- **Product framing:** an open-source product heading for mainnet. The use cases on the landing page are fictional and labelled *Illustrative* until there are real pilots (DECISIONS, 2026-11-04). Pilot applications go by email to the address in `PILOT_EMAIL` (`app/src/features/landing/landingContent.ts`).
- **Health:** the hourly live check, CI and the nightly end-to-end suite were green on 15 Nov, except for one end-to-end stall described under [Known issues](#known-issues).

## Services and accounts

| What | Where | Notes |
|---|---|---|
| Hosting | Vercel project `ancora` (team `team_xirrUVu2J9SfwzpeKmFiMfK6`, project `prj_6voCmAG5QelT7MXNdc60kBoLwHHR`), Pro plan | Root Directory `app`; production deploys from `main`. One daily cron: `/api/due` at 07:00 UTC (`app/vercel.json`). |
| Off-chain records | Neon Postgres, project `ancora` (`twilight-breeze-67785613`), aws-eu-central-1 | Schema `app/db/schema.sql`; access only through `app/api/_lib/database.ts`. Holds discussions, pictures, push subscriptions, registry names and the scheduler's organization list. |
| Source and CI | GitHub `raglibol-re/ancora` (public) | Workflows below. Failure emails come from these workflows, not from Vercel. |
| Chain | Stellar testnet via `https://soroban-testnet.stellar.org` | Contract IDs: README, [Testnet contracts](../README.md#testnet-contracts). |
| Operator key | `GC2BKJOG56UXZQKMV475BNHMEHUA54GPGY6W2FILRB4DHCOJFJXOYJE3` (Stellar CLI alias `ancora-deployer`) | Pays fees, deploys organizations, runs due requests, hands out test money. Holds no role in any organization. Server calls travel on eight channel accounts derived from its secret (`api/_lib/channels.ts`). |

The old Vercel Blob store (`store_Ci77NprR2Bdf2Dh8`) is no longer used or connected; its token is removed and its useful records were copied to Neon. Deleting it is left to the account owner (`vercel blob delete-store`, interactive).

### Secrets

All documented in `app/.env.example`; local values live in the gitignored `app/.env.local`.

| Secret | Where it is set |
|---|---|
| `DEPLOYER_SECRET`, `ADMIN_PASSPHRASE`, `CRON_SECRET`, `VAPID_PRIVATE_KEY` | Vercel (production, preview), by `scripts/setup-testnet.sh --sync-vercel` |
| `DATABASE_URL` | Vercel (production, preview) and GitHub Actions |
| `BACKUP_PASSPHRASE` | GitHub Actions; keep a copy outside the repository, without it no backup can be read |

### GitHub workflows

| Workflow | When | What it checks |
|---|---|---|
| CI (`ci.yml`) | every push | `pnpm verify`, contract fmt, clippy and tests |
| Live check (`live-check.yml`) | hourly at :17 | production answers, can sponsor fees and hand out test money (`scripts/check-live.mjs`) |
| E2E (`e2e.yml`) | nightly 05:30 UTC, or by hand | the eleven Playwright flows against production |
| Backup (`backup.yml`) | nightly 03:15 UTC, or by hand | encrypted export of the Neon tables, kept 90 days |

## Operating it

**Deploying.** Push to `main` after `cd app && pnpm verify` (and the contract checks when `contracts/` changed). Then confirm the GitHub commit status "Vercel" is `success` and the live site answers; a green CI does not mean production updated.

**Health.** `/api/health` reports the RPC (ledger, protocol, latency, error text) and which test stablecoins can be handed out. `/admin` (passphrase) shows the same plus contract presence, the operator's XLM and stablecoin floats and the relayer's allowed origins.

**Fee float.** New passes, organizations and payments cost the operator roughly 100 test XLM per new visitor (testnet rent is high; ARCHITECTURE, *Testnet rent*). The XLM float does not refill on its own: top it up from Friendbot with the button in `/admin` when it runs low. It held about 34,000 XLM on 15 Nov.

**Test money.** Grants come from the operator's float of each accepted stablecoin (`api/test-money.ts`, `api/_lib/testMoney.ts`). Below 500 a grant shrinks to a tenth of the float, and a refill starts in the background:

| Asset | Refill |
|---|---|
| BlendUSDC | Blend's testnet faucet, claimed by a Friendbot-funded throwaway key and forwarded (`api/_lib/blendFaucet.ts`) |
| Circle USDC | buys USDC with a throwaway key's Friendbot XLM on the testnet XLM/USDC pool, paid straight to the operator (`api/_lib/dexRefill.ts`) |
| Circle EURC | none: the faucet needs a captcha and the testnet has no EURC liquidity; top up by hand at faucet.circle.com |

**Testnet reset.** Stellar resets the testnet from time to time and announces it ahead. Every ancora contract disappears with it. Afterwards run `scripts/setup-testnet.sh --sync-vercel` (builds, uploads and deploys the contracts, writes `app/.env.testnet`, pushes the server variables and redeploys), then refill the floats and check `/admin`. Passes and organizations from before the reset are gone; so are the Neon records' references to them, which can be cleared.

**Protocol upgrade.** When most flows fail at once and `/api/health` shows an RPC decoding error, the pinned `@stellar/stellar-sdk` (16.4.x) can't read the new protocol yet. Look for an SDK release named after the protocol and update the pin.

**Backups and restore.** Steps in ARCHITECTURE, [Backups](ARCHITECTURE.md#backups). By hand: `pnpm db:backup <file>` and `pnpm db:restore <file>`.

**Releases of the contracts.** Contract versions are published on the Stellar Registry by the operator (`scripts/publish-registry.sh --publish` after bumping `contracts/Cargo.toml`). Never redeploy the registry or recovery contract: every organization stores their addresses.

## Testing

- **Unit tests** (`pnpm verify`): the domain engine, adapters' pure parts, API helpers. One Vitest test is occasionally flaky; rerun once before investigating.
- **Contracts** (`cd contracts && cargo test`): every public function, including strict-auth tests without `mock_all_auths`.
- **End-to-end** (`cd app && pnpm e2e`): Playwright against production with Chromium's virtual WebAuthn authenticator (`e2e/virtualPasskey.ts`), so passkeys need no device. Locally it uses the installed Edge. The flows, one file each under `app/e2e/`: core path, approval, deal, German first path, Lifeline, money (standing order and Reserve), second passkey, confidential pots, private details, registry name, quantum-safe seal. Every run creates real passes and organizations whose fees the operator pays.
- **Reading a failure:** `gh run download <run id>` gives screenshots, `error-context.md` (an accessibility snapshot of the failing page) and `trace.zip`. The trace's network log shows whether a transaction was sent at all; its action log shows how long each click took.

## Open work

In priority order. Product milestones are in ROADMAP.

1. **Legal pages:** imprint (Impressum), terms and privacy, English and German. They need the legal entity, address and contact person; none of these exist in the repository yet and must not be invented.
2. **Mainnet preparation:** the open items under ROADMAP, *SCF #46 milestones* and *Off-chain records* (an off-GitHub backup copy, a scheduled restore drill, registry names read from the registry instead of a table).
3. **`app/src/adapters/testnet/testnetDataSource.ts`** is about 460 lines against the 250-line guideline. Commands, session, identity, reads and workspace building are already separate tested modules; what remains is the session state, the refresh loop and the wiring (about 135 lines of constructor). Splitting further means a second stateful object; worth it only if the class grows again.
4. **Pilot contact:** move `PILOT_EMAIL` to a pilot@ address once ancora has its own domain and mailbox.
5. **API function budget:** `api/_lib/functionBudget.test.ts` still caps the API at twelve functions, a limit of Vercel's Hobby plan; the project is on Pro now. Raise or remove the cap once Pro's limit is confirmed in Vercel's documentation. There are eleven functions today; related routes share one function by HTTP method, which is fine to keep.

## Known issues

- **End-to-end stall in CI (15 Nov, run `43728889451`):** the deal flow's "Propose the deal" click took 154 s while the page stopped painting, so no transaction was sent and the flow timed out. It passed locally right after, and profiling the Deals page with a 4× slower CPU showed 1.8 s of long tasks in the first 5 s and idle afterwards. The likely cause is the CI runner's browser. If stalls appear in other flows too, try retries or a larger runner before changing code.
- **Testnet RPC latency** is often 1–6 s per call. The app waits 12 s for `/api/health` before falling back to sample data, and every RPC client times out after 30 s (`app/shared/rpcServer.ts`; always use `rpcServer()` or `withRpcTimeout()`).
- **Pictures uploaded before 12 Nov** point at the old Blob store and show initials once it is deleted, until they are uploaded again.
- **The automatic stablecoin refills** have run in tests and by hand but not yet inside a live request; they start when a float drops below 500.

## Real, simulated, unverified

- **Real on testnet:** everything marked so in the README feature table; both automatic stablecoin refills (mechanism exercised on 4 and 15 Nov); the nightly backup and its restore (drilled into an empty Neon branch on 15 Nov).
- **Simulated:** sample data, the IBAN card, the fallback exchange-rate table, the landing page's use cases.
- **Unverified:** the first scheduled run of the backup workflow; a restore of discussion rows (the tables were empty during the drill); the refills firing inside a live request.
