# Handoff (5 Nov 2026)

For the next person or agent picking up ancora. Read `CLAUDE.md` first (binding working rules), then this, then `docs/ROADMAP.md`. Last updated after commit `a5faa80`.

## Where things stand

- **Live:** https://ancora-gray.vercel.app (Vercel project `ancora`, team `team_xirrUVu2J9SfwzpeKmFiMfK6`, project `prj_6voCmAG5QelT7MXNdc60kBoLwHHR`). Production deploys from `main`; check the GitHub commit status "Vercel" after each push.
- **Network:** Stellar testnet, protocol 30. Every product feature runs on real contracts with test money; sample data is the labelled fallback.
- **Product framing:** the landing page and README present ancora as an open-source product in public preview heading for mainnet (mission, vision, illustrative use cases, path to launch, pilot requests through GitHub issues, FAQ). The use cases are fictional and labelled "Illustrative"; keep it that way until there are real pilots (see DECISIONS, 2026-11-04).
- **Next external milestone:** the Stellar Community Fund #46 application (8 Nov 2026); milestones in `docs/ROADMAP.md#scf-46-milestones`. The video script is `docs/DEMO.md`.

## What changed 3–5 Nov (newest first)

| Commit | What |
|---|---|
| `a5faa80` | README reframed as an ongoing product (mission, status, get involved); stale lines fixed |
| `6c41b99` | App waits 12 s (was 4 s) for `/api/health`; the server caps the optional test-money check at 3 s. A slow testnet RPC had sent visitors (and the E2E runs) to sample data |
| `567148f` | Landing page: Preview bar, use cases, mission/vision/principles, path to launch, pilot invitation, FAQ, footer; English and German. Split into `landingContent.ts`, `CompanySections.tsx`, `LaunchSections.tsx`, `LandingSections.module.css` |
| `f0a34f7` | Sample team renamed from "Meridian Hack Team" to "Ponte Product Team" (id `ponte-team`) |
| `8549a61` | BlendUSDC test float refills itself from Blend's faucet (`api/_lib/blendFaucet.ts`, triggered in `api/test-money.ts` via `waitUntil` when a grant leaves it below 500) |
| `9444efb` | Private-details key restore waits for the passkey reconnect before asking for PRF |
| `695b163` | Every RPC client times out after 30 s (`app/shared/rpcServer.ts`; always use `rpcServer()` / `withRpcTimeout()`, never `new rpc.Server`) |
| `6a84a9e` | Operator console shows the RPC health error text |
| `a8b844f` | `@stellar/stellar-sdk` 16.4.1 (16.3.1 can't decode protocol 30 ledgers) |

## Open work, in priority order

1. **E2E status.** Run `42034618737` was started on `a5faa80` (https://github.com/raglibol-re/ancora/actions/runs/42034618737). Read it first.
   - The scheduled run `41836059498` (4 Nov, before `6c41b99`) failed all 8 flows waiting for "Welcome to ancora": the app had fallen back to sample data because `/api/health` took 4.5–6.5 s. Expected to be fixed by `6c41b99`; unverified until that run finishes.
   - Before that, run `41743838145` had 6/8 green; **potFlow** and **privacyFlow** still failed after `9444efb` and `8549a61`. Not investigated yet. Its artifacts were downloaded to the previous session's scratchpad (gone); fetch them again with `gh run download <id> -D <dir>` and read the screenshots and `trace.zip` (the `error-context.md` can show another test's page).
2. **Off-chain records are in Neon Postgres since 12 Nov** (project `ancora`, id `twilight-breeze-67785613`, Frankfurt; `DATABASE_URL` on Vercel and in `app/.env.local`; schema `app/db/schema.sql`, applied with `cd app && pnpm db:schema`). Vercel Blob is no longer used by the code: its store was blocked (every read 403) for exceeding the Hobby allowance, because every open app re-read all discussions twice a minute. Data from Blob was not carried over. Left to do: `docs/ROADMAP.md#off-chain-records`. The failure emails come from the GitHub Actions `Live check` and `E2E`, not from Vercel deployments.
3. **E2E flakiness.** Fixed on 12 Nov: pass creation failing with "The confirmed deployment transaction is unavailable" (the kit asks the RPC once; `passkeyKit.ts` now asks again on "not found"), the empty approvals address after paying (`created()` in `testnetDataSource.ts`) and standing orders tried only once per visit. Watch the nightly run; a new failure is a new cause.
4. **`testnetDataSource.ts` is down from 1,437 to about 460 lines** (rule: about 250). On 12 Nov the retry and loading logic and four support objects moved into tested modules next to it (`createdItem`, `dueOrderRuns`, `discussionThreads`, `freshTransactions`, `schedulerAnnouncements`, `registrySupport`, `walletSupport`, `lifelineSupport`, `deviceKeySupport`). On 13 Nov the organization commands followed: `requestCommands.ts` (requests, approvals, seals, handovers) and `organizationCommands.ts` (founding, changes, Reserve, recipients, links, standing orders), both built from `commandDeps.ts`; `TestnetDataSource.open()` joins them to the session. Then the passkey connection and signed calls (`passkeySession.ts`), the pass itself (`identitySupport.ts`), calls to ancora's own routes (`serverRoutes.ts`) and the shared short-lived reads (`sharedReads.ts`, tested). Last, restoring the session (`sessionRestore.ts`, tested), opened private details (`revealedDetails.ts`), building the workspace from chain data (`workspaceFromChain.ts`), the history backfill (`historyBackfill.ts`) and discussions (`discussionSupport.ts`). The class now holds the session's state, the refresh loop and the wiring of all these parts; about 135 of its lines are the constructor that hands each part what it needs. Splitting further would mean a second stateful object for the workspace; not worth it unless the class grows again.
5. **Legal pages:** imprint (Impressum), terms, privacy. Needs the legal entity, address and contact from the user; don't invent them.
6. **Pilot contact:** pilot requests go to public GitHub issues (`PILOT_REQUEST` in `landingContent.ts`). The user may want an email or private form instead.
7. Circle USDC/EURC test floats are empty (their faucet needs a captcha); only BlendUSDC refills automatically.

## How to work here (things that cost time)

- **Verify, push, confirm:** `cd app && pnpm verify` must exit 0 (gate on the exit code, not on grepping output), then push to `main`, then wait for the "Vercel" status `success`. Vitest has one occasionally flaky test; rerun once before digging.
- **Windows line endings:** Python `open(..., 'w')` writes CRLF on Windows and Biome fails. Use `newline=''` when rewriting files, or run `npx biome check --write <files>` afterwards.
- **Heredocs:** Git Bash heredocs break on backticks and sometimes on long quoted text; write content with the Write tool into the scratchpad and merge it in.
- **German copy:** every `t()`/`msg()` literal needs an entry in `app/src/ui/messages/de.ts` (formal "Sie"); `src/ui/i18n.test.ts` lists what's missing.
- **Screenshots:** Playwright's bundled Chromium isn't installed locally; launch with `chromium.launch({ channel: "msedge" })` against `npx vite preview --port 4317` (stop the server afterwards).
- **Testnet RPC is often slow** (1–6 s per call on 4 Nov). When many flows fail at once, check `curl https://ancora-gray.vercel.app/api/health` (`rpc.ok`, `rpc.error`, response time) before blaming the code; after a protocol upgrade, look for a 16.x SDK release named after the protocol.
- **Not available to agents here:** Vercel runtime logs through the MCP (403), `vercel env pull` of secrets, `curl | bash` installers, `cargo install stellar-registry-cli` (blocked by the permission classifier; don't work around it).
- **Memory pressure:** background watchers get killed; prefer one-shot checks or short foreground loops.
- **Stellar CLI:** `/c/Program Files (x86)/Stellar CLI` (not on PATH); operator key alias `ancora-deployer` (`GC2BKJ…YJE3`).
- Commit messages end with the `Claude-Session:` line given by the session; small conventional commits; docs (CHANGELOG, README, ROADMAP, ARCHITECTURE, DECISIONS) in the same commit as the change.

## Real, simulated, unverified (as of this handoff)

- **Real on testnet:** everything in the README feature table marked so; the BlendUSDC auto-refill (claimed once live, float ~2,471 on 4 Nov); the health timeout fix (response ~3.4 s after deploy).
- **Simulated:** sample data, the IBAN card, the fallback exchange-rate table, the use cases on the landing page (fictional, labelled).
- **Unverified:** whether `6c41b99` brings the nightly E2E back to green; the cause of the pot and privacy flow failures; the automatic refill firing inside a live request (it triggers when the float drops below 500).
