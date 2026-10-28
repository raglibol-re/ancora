# Roadmap

Status legend: **Real on testnet** · **Simulated** (labeled sample data in the UI) · **Roadmap**.

## Now: HackMeridian 2026 (deadline 26 Oct 2026, 12:00 Lisbon)

| # | Task | Status |
|---|------|--------|
| 0 | Scaffold: PWA app shell, routing, tokens, CI, docs, Vercel | Done |
| 1 | Approval rules engine (pure TS, tested) | Done |
| 2 | App screens on sample data behind the data-source interface | Done |
| 3 | Testnet setup script (keys, contract deploys, IDs) | Done |
| 4 | Passkey smart accounts + fee-sponsoring relayer | Done |
| 5 | Demo admin: data-source fallback switch + health panel | Done |
| 6 | Approval rules on-chain: organization contract + registry, policy document hash, identities | Done (see below) |
| 7 | Reserve on DeFindex testnet vault | Done for BlendUSDC (see below); confidential split moved to task 14 |
| 8 | Security seal: ML-DSA verifier as OZ external signer (timebox 2h) | Verifier done and on testnet; device key + account wiring: next |
| 9 | Crew / agent keys with spending limits | Done, natively in the organization contract (see DECISIONS: why not OZ `spending_limit`) |
| 10 | Bank in/out: SEP-24 with the SDF test anchor (real on testnet); a licensed euro anchor or Bridge later | Done for deposits and the withdrawal request (see below) |
| 11 | Organization logo in Vercel Blob with the URL on the organization contract | Done |
| 12 | Budgets and bookkeeping | Done: budgets are on-chain rules (soft or hard envelopes per category and period), CSV statement |
| 13 | Demo admin: reset, top-up, retry stuck requests | Done: sample reset, XLM top-up from Friendbot in /admin, per-asset floats in health; due requests are sent with "Send now" by any member |
| 14 | Confidential pot + auditor view stub | Documented only (no placeholder UI): see Later |
| 15 | Integrate the Claude Design package | Done (brand, icons, tokens) |
| 16 | Request discussions: pro/contra reasons, questions, comments, thumbs up/down (see below) | Done (notifications, attachments and signed entries: later) |
| 17 | Recovery ("Lifeline"): guardians, claims with a waiting period, cancel by the current pass (see below) | Done for the position handover (see "as built"); inactivity path and succession plans: next |
| 18 | Recovery device in onboarding: second device, hardware key, pairing by QR (see below) | Done: "Devices" on the pass page (count, "Add a passkey", the browser's own QR flow reaches another phone) and a reminder across the app until a second passkey or guardians exist |
| 19 | Secure handover: escrowed payments released only when recipient and sender confirm | Done (organization contract + recipient link page) |
| 20 | Standing orders: repeating payments under the rules | Done: organization contract, Send page, and a daily Vercel cron (`/api/standing-orders`) that visits every indexed organization |
| — | Submission polish: README with a short GIF of the flow, screenshots, demo video link | GIF and screenshots done; the demo video link is added by the team at submission |

### Task 6 as built: one passkey per person, one contract per organization

- **Person = OpenZeppelin smart account** created by smart-account-kit with the passkey as its WebAuthn signer; its address is the person's *ancora ID*. The same ID holds different positions in different organizations.
- **Organization = `ancora_organization` contract** (`contracts/organization`): holds the USDC, roles with OZ AccessControl, the approval engine (ported from `app/src/domain/rules`, tested against the same `contracts/test-vectors`), requests, objection windows, the setup phase and the lock-out guard. The operator deploys it with the founder as its only member and holds no role.
- **`ancora_registry`** (`contracts/registry`): profiles (name, picture URL) and the organizations per person, so any device finds everything with one read. Organizations update the membership index themselves (direct-invoker auth).
- **Policy document**: each organization's rules are one canonical JSON document (`app/shared/policyDocument.ts`, with the rules' home currency); the contract stores its SHA-256 at creation and with every rule change, the Rules page verifies it.
- **Several stablecoins**: an organization accepts a list of tokens (BlendUSDC, Circle USDC and Circle EURC on testnet, from the `ORG_ASSETS` allowlist), each with its own balance, payments and test money; accepting or dropping one is a governance change. Payments in an asset of another currency than the rules take the strictest tier and the seal.
- **App**: passkey sign-in/sign-out, profile page ("your pass"), invites by ancora ID, commands signed through the person's account (`execute`), "Send now" for due requests via the operator, reads by simulation, 30 s refresh.
- **Follow-ups**: live FX rate from the Reflector oracle (SEP-40) so payments in another currency hit the right tier; template switching on-chain; cumulative crew limits through OZ `spending_limit` installed on the organization's context (task 9); Perch-style IR for function-level constraints once needed.

### Task 7 as built: the Reserve

- The organization contract deposits into and withdraws from the asset's DeFindex vault itself (`move_to_reserve`, `withdraw_from_reserve`); the top role or any strictest-tier approver may do it, no request needed. The vault's token pull is authorized as a sub-invocation.
- `reserve(token)` reports shares, value and principal; the app shows the value and "earned so far" per asset. Assets without a vault (Circle USDC today) show "No Reserve yet".
- Follow-ups: auto-sweep rules (keep X on the account, rest in the Reserve), more vaults as DeFindex adds them on testnet, the confidential split (task 14).

### Task 8 as built: the quantum-safe seal verifier

- `contracts/seal_verifier`: ML-DSA-44 (FIPS 204) verification in a 15 KB Soroban contract with OpenZeppelin's external-verifier interface; shared vector from `@noble/post-quantum`; deployed once by the setup script and checked on-chain (valid → true, tampered → false).
- Still to do (SCF milestone): generate the ML-DSA key on the approving device, store it in the browser's IndexedDB (non-extractable where the platform allows), add it to the person's smart account as an external signer on a context rule that only covers `seal`, and sign the seal with it; swap the verifier body for the native host function after Protocol 30.

### Task 9 as built: spending limits for crew and agent keys

A member can carry a spending limit: an amount per day, week or 30 days in the rules' currency, granted or removed through the governance change `SetSpendingLimit` (a request after the setup phase, like any rule change). A payment inside the requester's remaining allowance executes at once and is booked against a rolling window in the organization contract; beyond it, or in another currency, the normal rules apply. An agent is a member whose key has a limit: any address that can authorize can be added. The Rules page shows what is left per person and lets the top role edit limits; the Send page says when a payment fits.

### Task 10 as built: bank in and out through a Stellar anchor

`adapters/testnet/anchorRamp.ts` speaks SEP-1, SEP-10 and SEP-24 with the anchor named by `VITE_ANCHOR_HOME_DOMAIN` (the SDF test anchor, which pays out test USDC). The person's wallet signs the anchor's challenge; the anchor's hosted form takes the bank details; ancora follows the transaction status. Deposits land in the wallet and move on to the organization through the existing wallet funding; a withdrawal turns the anchor's instructions (account and reference) into a payment request from the organization, so it follows the rules. Verified: the protocol end-to-end with a keypair; not yet: the hosted form in a browser session and the anchor's payout after the organization pays. A euro anchor or Bridge needs KYB and comes with the licensed partner.

### Task 12 as built: budgets are rules

A budget is part of `Policy`: category, amount per rolling period in the home currency, and whether it is hard or soft. Changing budgets is a rule change (`UpdatePolicy`, document v3 hash). A payment carries an optional category; the contract books it against the budget's running window at proposal time and gives it back on decline. Inside what is left the payment follows its own tier; beyond it a soft budget forces the strictest tier and flags the request for approvers, a hard budget refuses it (`BudgetExceeded`). Payments in another currency can't be measured: soft flags them, hard refuses them. The Rules page edits budgets, the Overview shows the meters, the Send page previews the verdict. "Download statement (CSV)" exports executed payments with their categories.

### Rules document v3 and perch

The rules document now follows stellar-registry/perch's canonical form (CANON v1: no whitespace, sorted keys, `u32` numbers only, amounts as decimal strings, no null, no booleans) so the same bytes can later be read by that toolchain. Older organizations verified against document v2; the Rules page says which version matched. Perch itself (testnet beta, pre-audit) models per-signer rights on a smart account and can't express role tiers, asynchronous approvals or budgets, so the organization contract stays the evaluator; see DECISIONS.

### Task 16: discussions on approval requests

Approvers decide better when the reasons are visible next to the request.

- **Thread per request** (payments and membership/rule changes). Entry types: *pro reason*, *contra reason*, *question*, *comment*. Questions can be marked answered by the requester.
- **Reactions:** thumbs up / thumbs down on reasons; one reaction per person per entry, changeable; never on your own entry. Shows which arguments the group actually backs.
- **Who:** members of the organization only. Posting doesn't count as approving, so four-eyes and the approval rules stay untouched.
- **UI:** discussion section on the request page; summary on request cards and in the inbox ("2 pro · 1 contra · 1 open question"); notice when someone replies to your request.
- **Storage:** the text is off-chain (not money, should stay private to the org). It goes behind the `DataSource` interface: sample adapter first, then a minimal Vercel-integrated store justified in DECISIONS.md. Optionally each approval records the hash of the discussion it was given on, so later readers can prove what an approver saw.
- **Later:** attachments (receipts, quotes) via Vercel Blob, @mentions, a requester-written decision summary.

### Task 17 as built: Lifeline hands positions to a new pass

The person's smart account itself is not recovered (that needs a contract signer on the OpenZeppelin account, which the kit's accounts don't accept yet); the positions are. `contracts/recovery` keeps, per person, a plan (one to five guardians, threshold, waiting period of at least a minute, two minutes to thirty days in the app) and at most one open claim (successor, confirmations, ready time). A guardian starts the claim with the person's new ancora ID, other guardians confirm, the person's old pass can cancel at any time before the end; `finish_claim` (no signature needed, ancora's server submits it) asks every registered organization built with the recovery contract to `recover_member(old, new)`: role, spending limit and founder flag move, the registry index follows. Money never moves; approvals already given stay under the old ID as history. Organizations deployed before this exist without `recover_member` and are shown as not recoverable. In the app: the Lifeline card on the pass page (status, plan editor, open-claim warning with cancel, banner across the app), "People you protect" for guardians, "Recover an old pass" for the new pass. Sample data simulates the same lifecycle.

### Task 17: recovery ("Lifeline"), the full design

Continuity for organizations when keys are lost or a person dies or is incapacitated. Recovery can **restore control, never move money**, and can **always be cancelled by any current signer**.

- **Guardians:** people, second devices, an offline recovery kit, or professionals (auditor, tax advisor). Threshold per organization (e.g. 2 of 3). Onboarded by invite link with a passkey; fees sponsored.
- **Claims:** guardians propose replacing or adding a signer → waiting period (default 7 days, configurable, longer for larger balances; 2 minutes in the testnet demo) → notifications to all signers → any current signer can cancel → after the delay the claim executes.
- **Inactivity path:** a heartbeat policy on the everyday context rule records the last activity on every signature. After a configurable period (e.g. 180 days) and unanswered check-in reminders, named successors may start a claim; the waiting period still applies.
- **Succession plan per role** (e.g. deputy chair for chair), so rules like 2-of-2 never deadlock when someone is gone.
- **Security design:** OZ context rules scope by *contract*, not by function, so guardians must **not** get a rule on the account itself. A dedicated **recovery contract** is where guardians sign claims; only that contract is authorized on the account (a `CallContract` rule), and its code can only swap signers after the delay. Verify in the OZ docs how a contract signer authorizes calls on the account. Use OZ's governance timelock module or a ledger-based delay. Use context-rule expiry (`valid_until`) for temporary guardians and successors.
- **Events:** all claims, cancellations and handovers emit events (activity feed, admin health panel).
- **Build order:** (1) recovery contract (guardians, threshold, delay, cancel, execute), guardian invite + claim UI, owner warning banner with cancel; (2) document and build only if time allows: heartbeat policy, inactivity path, succession plans; (3) roadmap: offline ML-DSA recovery key, Perch function-level constraints, a professional guardian service.
- **UI wording:** on-chain recovery supports, but doesn't replace, legal processes (board elections, register entries, proof of inheritance).

### Task 18: recovery device in onboarding

- **Onboarding steps:** 1) create passkey, 2) create or join an organization, 3) add a recovery device (recommended, skippable once), 4) choose guardians (optional), 5) done, with a visible recovery status ("Protected: 2 devices, 2 guardians" / "Not protected yet"). Today the profile page shows "Not protected yet" honestly.
- **Recovery device options:** another device the person owns (recommend a different ecosystem: synced passkeys don't help when the Apple or Google account is lost), a hardware security key, or (roadmap) an offline recovery kit, later an ML-DSA key.
- **Pairing without a server:** the existing device shows a link/QR → the new device opens it, creates a passkey for the same RP ID and shows its public key as a QR plus a short matching code → the existing device scans it, the person compares the matching code on both screens and confirms with Face ID, which signs adding the new key as a signer. Copy-paste fallback for devices without a camera.
- **Personal level:** adding one's own recovery device needs only the person's existing passkey (a signer on their personal smart account); it is logged in the activity and the organizations are notified. Done once per person, it covers every organization.
- **If skipped:** persistent reminder banner and the recovery status on the profile and overview until a recovery device exists.

## Next: SCF #46 milestones

- Stellar Registry: publish the four contract Wasm files as named, versioned releases (`scripts/publish-registry.sh`, dry run by default), show the release name and version next to the contract hash in expert mode, then deploy organizations through `stellar registry deploy` so an organization's code is a public release rather than an operator-held hash; attested builds through the registry's GitHub action once the repo is public.
- Perch adoption in three steps: publish ancora's document in perch's IR where it fits, lower per-member allowances onto perch `cap` rules once organizations can be perch accounts, and propose `i128` range predicates and asynchronous approvals upstream so the tiers can move too.
- Custom roles (editable list and ranks through governance; templates become presets), per-member limits per category and asset, recipient allowlists.
- History beyond RPC's week for devices that were away: an indexer (Mercury or SubQuery) or the explorer's API behind the same `orgHistory.ts` interface.

- Switch the security seal from the in-contract ML-DSA verifier to the native ML-DSA host function after Protocol 30 "Bell" (mainnet vote 23 Nov 2026).
- Lifeline in full (inactivity path, succession plans, professional guardians).
- Licensed ramp partner integration (EUR IBAN/SEPA, USD/ACH) in production mode, and cash in and out through MoneyGram Access (SEP-24 like the test anchor, so `anchorRamp.ts` takes a second home domain) for organizations that handle cash.
- Security review of the organization, registry and recovery contracts; mainnet readiness.

## Production: what a real user app still needs (assessed 26 Oct 2026)

Measured against Revolut Business for everyday banking, Squads (Solana) and Safe (EVM) for treasury governance. Ordered by what blocks real use first; each item names what exists today.

### A. Trust and safety, before any mainnet

1. **End-to-end tests with a virtual passkey.** Started 28 Oct: `app/e2e` drives production nightly (create a pass, sign out and in, found an organization, take test money, pay); its first runs found two bugs and a broken deploy. Next: approvals with a second pass, standing orders, Reserve, Lifeline. Playwright with Chromium's WebAuthn virtual authenticator can create a pass, an organization, a payment, an approval, a standing order and a Lifeline claim against the testnet, nightly in CI. This is the single biggest quality lever.
2. **External security review** of the organization, registry and recovery contracts, plus a threat model for the relayer (fee sponsorship), the wallet index and the Blob stores.
3. **Mainnet profile.** Network settings per environment, the operator key in a KMS rather than a Vercel secret, a fee budget with alerts, rate limits on every function, backups of the Blob data (discussions, registry names, organization index), an upgrade path for organizations (a governed `upgrade` of an organization's Wasm; today a new organization is needed).
4. **Monitoring.** Error tracking for app and functions, an uptime check on `/api/health`, alerts when the operator's XLM or stablecoin floats run low. Today: recent errors per browser and the admin health panel.
5. **Legal and partners.** KYB and fiat through a licensed partner (euro SEPA anchor, MoneyGram Access for cash), terms and privacy, the "not a bank" wording reviewed per jurisdiction.

### B. Everyday banking parity (Revolut Business)

6. **Notifications.** Web push done 28 Oct: approval needed, request done/approved/declined, Lifeline claim started. Next: money received (needs ledger events, not the relayer), standing order refused, email through a partner.
7. **Address book.** Done 28 Oct: saved recipients on the organization contract with name, note, who saved them and last payment; save while paying. Next: recipient allowlists built on it (C14).
8. **Statements and search.** Done 28 Oct: Activity page with search and filters, monthly statement (print/PDF) and CSV. Next: receipts and attachments per payment (Blob, hash on the request), opening balances once full history is indexed.
9. **Batch payments.** Done 28 Oct: up to 50 lines in one asset, approved once on the total, paid atomically. Next: CSV import of lines, reimbursement claims by members.
10. **Payment requests and links.** An organization asks for money (membership fees, invoices) with a link or QR and sees who paid; reminders for fees.
11. **Sub-accounts.** Pots per project or team with their own budgets and views.
12. **Exchange inside the app.** EURC ↔ USDC through path payments with a quote (Reflector or SDEX) and a rule-aware preview; today another currency takes the strictest tier.
13. **Languages and access.** German and Portuguese, a WCAG AA audit, onboarding tour, help pages, skeleton states while the chain is read.

### C. Treasury governance parity (Squads, Safe)

14. **Custom roles**: done 28 Oct (add, reorder, drop through governance; templates are presets). Still open: per-category and per-asset spending limits, recipient allowlists. Contract change.
15. **Any action under the rules.** Approve arbitrary calls to allowlisted contracts the way Safe's transaction builder does, with a simulation preview; today only payments and governance changes.
16. **More policy.** Velocity limits per period for the whole organization, emergency freeze by a quorum, time locks per tier (the objection window exists).
17. **Keys.** Hardware security keys through the passkey flow (exists, untested), the ML-DSA device key for the seal, passkey re-authentication for sensitive actions.
18. **Integrations.** Signed audit-log export, webhooks, an SDK, accounting exports (DATEV, QuickBooks).
19. **Lifeline in full.** Inactivity path and succession plans (recovery contract change).

### D. Platform

20. **Releases through the Stellar Registry**: every contract version published and named, organizations deployed by name, attested builds.
21. **Preferences across devices** through the profile store, and a settings page that explains every switch.

Suggested order: A1, then C14, B7, B6, B8, B9, A3 and A4 in parallel with the rest, and A2 before mainnet.

## Outlook

- **Non-fungible holdings:** membership cards, certificates and tickets as OpenZeppelin NonFungible tokens held by the organization next to its stablecoins (the asset list already pairs a token address with what it stands for; NFTs need no amounts, so they bypass the tiers and use governance for transfers).
- **Live FX for the rules:** Reflector oracle rates so a EURC payment in a USD organization is evaluated at today's rate instead of the strictest tier.
- **Per-asset Reserve:** a DeFindex vault per stablecoin once they exist on testnet; today only BlendUSDC has one. Auto-sweep rules on top.

## Later

- Confidential payments with auditor view (OZ Confidential Token, once zk proof verification is available).
- x402 agent payments (open SCF RFP for an x402 facilitator).
- Cards.
- Sub-accounts via Protocol 30 muxed contract addresses.
- Declarative policy IR in the style of stellar-registry/perch for per-call constraints (function, argument ranges), lowered onto the organization contract's rules.
