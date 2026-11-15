# Changelog

Notable changes to ancora, newest first. The project is in public preview on the Stellar testnet and has no versioned app releases yet; contract releases are named where they matter.

## 2026-11-15

### Added

- Nightly encrypted backup of the off-chain records, kept for 90 days as a GitHub workflow artifact; `pnpm db:backup` and `pnpm db:restore` run it by hand. Restore steps in `docs/ARCHITECTURE.md#backups`.
- Circle test USDC refills itself: when a grant leaves the operator float below 500, the server exchanges Friendbot XLM for USDC on the testnet exchange. EURC is still topped up by hand.
- Nightly end-to-end flows for a second passkey (add one, lose the first, sign in and found an organization with the second), Lifeline recovery and a Stellar Registry name.

### Changed

- "Apply for the pilot" on the landing page now goes by email instead of a public GitHub issue, with the address shown below the button; FAQ and README match.
- The organization list and registry name from the old Vercel Blob store were copied into the database and the Blob token removed. Earlier discussions and push subscriptions were not recovered; pictures uploaded before 12 Nov show initials until uploaded again.
- Documentation: `docs/HANDOFF.md` is now a maintainer handbook, `CONTRIBUTING.md` holds the contributor rules, ARCHITECTURE covers Lifeline, the database and scheduled jobs, and stale figures in README, ROADMAP and DEMO are corrected.

### Fixed

- After a page load, "Your pass → Devices" could stay on "Reading your passkeys…" and "Add a passkey" could fail. Both wait for the passkey to reconnect; a failed read offers "Try again".

## 2026-11-12

### Changed

- Off-chain records (discussions, pictures, push subscriptions, registry names, the scheduler's organization list) moved from Vercel Blob to Neon Postgres. New pictures are served from `/api/image`.
- Records the old store could not return at the time were not migrated: earlier discussions, registry names and notification subscriptions. Turn notifications on again in Settings.
- Discussions load when approvals, the inbox or a request page opens instead of polling; the request page shows loading and error states with "Try again". Posting and reacting no longer re-read the organization from Stellar.
- The site-wide default data source is the `DEFAULT_DATA_SOURCE` env var; the operator console shows it and no longer switches it.
- Landing page phone header: the language switch reads "EN / DE" and the header's "Get started" button gives way to the hero's below 480 px.

### Fixed

- Creating a pass could end with "The confirmed deployment transaction is unavailable" although the pass existed; the transaction lookup now retries for a few seconds.
- After sending a payment or batch, or creating a payment link, the app could open an empty or previous request. It now waits briefly for the new one, then opens the list.
- A due standing order whose run failed once stayed "Due now". It is retried on refresh, up to three times per visit and never twice at once; failed scheduler registrations are retried too.
- The hourly live check warns instead of failing when the RPC is too slow to read the BlendUSDC float; organization pages omit the registry name instead of erroring when the database is unavailable.

## 2026-11-05

### Changed

- Documentation: `docs/HANDOFF.md` records the current state, open work in priority order and working notes.

## 2026-11-04

### Added

- BlendUSDC test money refills itself: when a grant leaves the operator float below 500, the server claims Blend's testnet faucet and forwards 1,000 USDC to the float. Circle USDC and EURC still need manual top-ups.

### Changed

- Landing page presents ancora ahead of launch: preview bar, illustrative use cases (sports club, company, NGO), mission and principles, path to launch, pilot invitation, FAQ and a fuller footer, in English and German.
- README presents ancora as a product in public preview: mission, status toward mainnet and how to get involved. "Demo admin" is now the operator console; stale feature lines corrected.
- The sample data's third organization is now "Ponte Product Team".

### Fixed

- Visitors were sent to sample data while the testnet worked, because slow RPC calls exceeded the app's health timeout. The app now waits up to 12 seconds and the health check caps its test-money probe at 3 seconds.
- "Bring back with my passkey" and private-details setup right after a page load could prompt for the wrong passkey or hang; they now wait for the reconnect and ask for this pass's passkey.

## 2026-11-03

### Added

- English and German: a language switch on the landing page, sign-in and side panel. ancora starts in the browser's language, remembers the choice and formats money and dates to match.
- German translations for every screen, request titles, rule previews, role and template names, periods, and rules-engine and contract error messages. A test keeps every contract, deal and pot error translated; custom roles keep their own names.
- Nightly end-to-end run in German: landing page, pass, new organization, test money and a payment, then switching back to English.
- PWA manifest: fixed app identity, store categories and icon shortcuts (Send money, Approvals, Activity). The payment-link page's tab title follows the language.
- The operator console's Stellar RPC card shows why a health check failed.

### Changed

- Landing page reads as a product site: feature cards drop prototype status labels and add private details and deals, a full footer replaces the HackMeridian 2026 hackathon line, and no hackathon references remain in the app or README.
- Pictures that cannot be loaded show initials; a refused picture upload says so instead of showing a generic server error.

### Fixed

- After the testnet moved to protocol 30, every ledger read failed with an XDR error. `@stellar/stellar-sdk` upgraded from 16.3.1 to 16.4.1.
- A Stellar RPC request that never answered could leave a step on "Sending to Stellar…" indefinitely. Every RPC request now times out after 30 seconds and tells the person to check before retrying.
- A slow page load could sign the person out when the passkey session took over 8 seconds; the pass is now kept until the session answers.

## 2026-11-02

### Added

- Confidential pot (preview, contract release 0.11.1): an organization can hold test USDC in a pot whose balance and pot-to-pot payment amounts are hidden on the network. Proofs are made on the device; every step is a request under the organization's rules. Built on OpenZeppelin's confidential token; not audited.
- Confidential pot payments appear in Activity and the statement CSV, including an auditor's when the pot key is shared. Each device keeps an encrypted snapshot so the pot stays readable beyond the network's retained history.
- Confidential pot page shows a payment waiting for approval and pauses new payments and merges until it runs; buttons show proof progress; the pay form suggests known organizations.
- Private details: payment references, batch lines, standing orders and discussions can be stored on Stellar encrypted with the organization's key, which each member keeps on their device. Amounts and recipients stay public. New keyring contract.
- Auditors (keyring release 0.10.0): members add an auditor under Settings → Private details; once access is shared, the auditor reads requests and recipients read-only on their own Audit page and can download the statement CSV. With private details on, saved recipients' names and notes are encrypted too.
- The Overview tells a member when someone is waiting for access to private details, with a Share access button.
- Backup codes for device-held keys (private details and the seal) under your pass → Keys on this device; the local cache keeps private notes encrypted.
- Passkey-derived keys: where the passkey supports PRF, the private-details and seal keys are derived from it, so a synced device can restore them. Older keys still use the backup code.
- Lifeline succession and quantum-safe seals (release 0.9.0): a member's successor claims their position after a quiet period unless the member acts; organizations can require large payments to be sealed with an on-device ML-DSA key checked by the contract.
- The Send page and batch form show when references are private and flag one too long to keep private.
- A standing order to a new recipient can save them to the address book.
- Nightly end-to-end runs for deals, ML-DSA sealing, private details shared between two members, and a standing order with Reserve moves.

### Changed

- Fewer Vercel Blob operations: the demo setting and discussion threads are cached briefly, and organizations are announced to the scheduler once per device. If the demo setting cannot be read, visitors get the testnet instead of sample data.
- The server logs why it falls back to sample data; the hourly live check now fails instead of warning.
- End-to-end tests select the testnet themselves instead of following the site-wide default.

### Fixed

- A founder's direct deal deposit during setup was still counted as available.

## 2026-11-01

### Added

- Deals between organizations (release 0.8.0): milestone escrow in an admin-free deal contract. Propose, accept, deposit, request payouts, approve or object, automatic payout after the objection period, joint cancel and an arbiter for disputes, each step under the organization's own rules.
- Finer controls (release 0.8.0): allowances per asset or budget category, a payee list (others take the strictest approvals or are refused) and live Reflector exchange rates for payments in another currency.
- Contract upgrades through the organization's own rules: the four contracts are published on the Stellar Registry as release 0.7.0, and Settings → Organization code proposes the move. The organization contract (interface 7) accepts `Upgrade` only to the latest `ancora-organization` release; older organizations cannot upgrade.
- Batch payments from a spreadsheet: CSV import with comma, semicolon or tab separators, optional header and decimal commas; every line stays editable.
- Server transactions run in parallel on eight channel accounts derived from the operator key, with fees paid through fee bumps; the health panel shows ready channels.
- Hourly live check (`scripts/check-live.mjs`) of the app, `/api/health`, RPC, BlendUSDC test money and the operator's XLM balance; failures send an email.
- Nightly end-to-end run with two passes on two devices: a payment request waits for the board member's approval, then the contract pays it out.
- ancora is open source under the Apache License 2.0.

### Changed

- Landing page, README and seal prompt describe the current security seal (an approver's passkey signature); the hero chip reads "Rules on-chain".
- `scripts/publish-registry.sh` uses the plain Stellar CLI.
- Documentation: the roadmap sets out the SCF #46 plan as three milestones with completion checks.

## 2026-10-31

### Fixed

- Concurrent server transactions (sponsored fees, organization creation, test money, scheduled runs) could fail with "status NOT_FOUND"; sequence clashes and RPC retry responses are now rebuilt and resent.

## 2026-10-28

### Added

- Payment links: request money as an invoice or fee via link or QR code; payers use any Stellar wallet on a public page and the contract records who paid. Organization contract interface 6.
- Batch payments: up to 50 payments in one asset as one request, approved once and paid out all or none. Interface 5.
- Activity page with search, filters, totals and CSV export, plus a monthly statement per asset that prints or saves as PDF.
- Push notifications per device for approvals waiting, request outcomes and pass recovery attempts.
- Address book of saved recipients shared by all members, with "Save to the address book" when paying someone new. Interface 4; older organizations list paid recipients read-only.
- Custom roles: add, reorder and remove unused roles as one rule change. New organization Wasm with `SetRoles` and a `version()` view.
- End-to-end test of the core path on testnet with a virtual passkey (`pnpm e2e`), run nightly in GitHub Actions.

### Changed

- Scheduler routes are consolidated into `/api/due` to stay within Vercel Hobby's twelve-function limit; a unit test enforces the limit.

### Fixed

- Production deployments since 26 Oct had been refused for exceeding the function limit.
- A signed action right after loading the app failed with "Wallet not connected"; it now waits for the passkey to reconnect.
- A new pass's name could be lost when leaving the sign-in screen early.
- Live exchange rates fell back to the simulated rate after Frankfurter moved to `api.frankfurter.dev/v1`.
- Account sheets closed when "Add money", the Reserve or "To a bank account" opened from them.
- The landing headline rendered incorrectly in Safari.

## 2026-10-26

### Added

- Standing orders: weekly, fortnightly or monthly payments under the organization's rules, run by a daily cron or "Run now" and stoppable by the owner or top role. Organizations created earlier lack the feature.
- Secure handover (escrow): a payment can be held after approval until recipient and organization both confirm; the recipient confirms at `/app/escrow/<org>/<id>`.
- Lifeline recovery: new `ancora_recovery` contract (guardians, threshold, waiting period) and `recover_member` on the organization contract; an app-wide banner shows open claims.
- Second passkey: add a security key, this device or another phone by QR, signed by the current passkey.
- Spending limits: a member can receive an allowance per day, week or 30 days that executes without approvals and is tracked on-chain.
- Budgets as on-chain rules (`Policy.budgets`): soft budgets escalate to the strictest tier, hard budgets refuse. Rules document v3; v2 still verifies older organizations.
- Several stablecoins per organization: the contract keeps an accepted-asset list and home currency; payments in another currency take the strictest tier and the seal. EURC is a third test asset. Fresh registry.
- Accept any Stellar asset from the Rules page by contract address or `CODE:ISSUER`, with an optional DeFindex vault.
- Reserve on DeFindex: move money into and out of an asset's vault, with value and earnings shown per asset.
- Security seal verifier: `ancora_seal_verifier`, an ML-DSA-44 (FIPS 204) verifier contract implementing OpenZeppelin's external-verifier interface, deployed on testnet.
- Bank deposits and withdrawals through a Stellar anchor (SEP-1/10/24), configured by `VITE_ANCHOR_HOME_DOMAIN`.
- Add money from a Stellar wallet (Freighter, Hana, xBull, Albedo) through Stellar Wallets Kit.
- Organization logo stored on-chain with `set_logo`; images uploaded through `/api/upload-image`, shared with profile pictures.
- Discussions on approval requests: reasons for and against, questions, comments and reactions, with membership checked against the organization contract.
- Stellar Registry: `scripts/publish-registry.sh` publishes the contract Wasm as versioned releases, and the top role can register a name for the organization contract.
- Activity read from ledger token-transfer events for the last week.
- A working bar and in-sheet status for every on-chain step; a glow replaces motion under reduced motion.
- Test money availability per asset: the add-money sheet explains when the operator float is empty.
- Recipient check before a payment: a G address must exist and hold an authorized trustline for the exact asset; trustlines from other issuers are flagged.
- "Protect your pass" reminder for a pass with one passkey and no guardians.
- Operator console: XLM top-up from Friendbot and operator floats per accepted asset.
- Statement download (CSV) on the Activity card.

### Changed

- Overview redesigned like a multi-currency banking app: headline balance in the home currency (other assets at an indicative ECB rate), an allocation bar, account rows per stablecoin, quick actions, a DeFindex Reserve card and activity grouped by day.
- Landing page reworked: night hero with a particle globe, Fraunces headline, sections for every shipped feature.
- App panel reworked with a collapsible Organization section and a phone drawer; header stays pinned and pages, sheets and drawer animate, with all motion off under `prefers-reduced-motion`.
- Faster start on testnet: cached organizations appear immediately while Stellar is re-read, and session checks, chain reads and SDK download run in parallel.
- Interface polish: clearer rules-document status, Send defaults to the asset with the most available money, budget modes named "Soft" and "Hard", no removing the last member or top-role holder, explanatory empty states, Open Graph and Twitter cards.
- Every screen names the browser tab.
- The server recognizes organizations through the registry instead of the latest Wasm hash.
- Documentation: the roadmap adds a production-readiness assessment.

### Fixed

- Signing in with an existing passkey on another device failed; ancora now serves the smart-account index the passkey kit needs.
- Sheets had no visible Close button and did not close on an outside tap.
- The hero headline shifted while the display font loaded; Fraunces is now self-hosted and preloaded.

### Removed

- The off-chain budget store, replaced by on-chain budgets.

## 2026-10-25

### Added

- Project scaffold: PWA shell (landing page, `/app`, `/admin`), design tokens, CI, docs and Vercel config.
- Approval rules engine in TypeScript: tiers, four-eyes, objection window, seal, new-recipient rule, membership and rule requests, setup phase and templates, with shared test vectors.
- App screens on labelled sample data: overview, inbox, approvals, send money with rule preview, rules editor, settings, new organization and organization switcher.
- Final brand: shield-and-anchor mark, lockups, PWA and iOS icons, favicons and brand tokens; the design package is kept in `design/`.
- Testnet setup script: deployer key, BlendUSDC float, verification of DeFindex and smart-account-kit deployments, `app/.env.testnet`.
- Passkey smart accounts on testnet (smart-account-kit 0.8.0), a fee-sponsoring relayer (`/api/relay`) and test money (`/api/test-money`).
- On-chain organizations and identities: each person is a passkey-secured OpenZeppelin smart account, each organization its own `ancora_organization` contract enforcing the rules, and `ancora_registry` keeps profiles and memberships. The rules document's SHA-256 is stored on-chain.
- Profile page ("your pass"), passkey sign-in and sign-out, invites by ancora ID.
- Demo admin at `/admin` with a health panel, recent errors and sample reset; `/api/health`.

### Changed

- Testnet is the site default; non-canonical hosts redirect to ancora-gray.vercel.app; organizations on testnet can pay each other; the relayer fee cap is 300 XLM.
- Documentation: the roadmap adds discussions on approval requests.
