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
2. **Vercel Blob usage (over the Hobby quota).** Symptoms: `/api/due` (daily cron) returns 500; `/api/health` reports `updatedAt: null` because `demo/state.json` can't be read (the server then uses `DEFAULT_DATA_SOURCE`, which is `testnet`). The biggest consumer is discussions: `testnetDataSource.refresh()` (every 30 s, line ~507) calls `/api/discussions` for every organization, and `api/_lib/discussionStore.ts` does a `list` plus one `get` per entry/reaction/answered-marker blob. Proposed (user has not approved yet):
   - load discussions only when a request or the inbox is opened, and store one JSON per organization instead of one blob per entry;
   - read the site default from the `DEFAULT_DATA_SOURCE` env var instead of Blob;
   - later: the scheduler's organization list from the on-chain registry; drop the Blob copy of registry names.
   Images and push subscriptions stay in Blob. Alternative: the user upgrades to Vercel Pro.
3. **Phone header in German:** the "Loslegen" pill is clipped at 390 px width (pre-existing; `LandingPage.module.css` nav).
4. **Legal pages:** imprint (Impressum), terms, privacy. Needs the legal entity, address and contact from the user; don't invent them.
5. **Pilot contact:** pilot requests go to public GitHub issues (`PILOT_REQUEST` in `landingContent.ts`). The user may want an email or private form instead.
6. Circle USDC/EURC test floats are empty (their faucet needs a captcha); only BlendUSDC refills automatically.

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
