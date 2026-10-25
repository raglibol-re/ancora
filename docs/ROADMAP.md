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
| 9 | Crew / agent keys with OZ spending-limit policy | Planned |
| 10 | Euro in/out: SEP-24 test anchor (real), Bridge (simulated) | Planned |
| 11 | Organization logo in Vercel Blob with the URL on the organization contract | Done |
| 12 | Budgets and bookkeeping | Planned |
| 13 | Demo admin: reset, top-up, retry stuck requests | Planned |
| 14 | Confidential pot + auditor view stub | Planned |
| 15 | Integrate the Claude Design package | Done (brand, icons, tokens) |
| 16 | Request discussions: pro/contra reasons, questions, comments, thumbs up/down (see below) | Planned |
| 17 | Recovery ("Lifeline"): guardians, claims with a waiting period, cancel by any signer (see below) | Planned, design accepted 25 Oct |
| 18 | Recovery device in onboarding: second device, hardware key, pairing by QR (see below) | Planned, design accepted 25 Oct |
| — | Submission polish: README with a short GIF of the flow, screenshots, demo video link | Before the deadline |

### Task 6 as built: one passkey per person, one contract per organization

- **Person = OpenZeppelin smart account** created by smart-account-kit with the passkey as its WebAuthn signer; its address is the person's *ancora ID*. The same ID holds different positions in different organizations.
- **Organization = `ancora_organization` contract** (`contracts/organization`): holds the USDC, roles with OZ AccessControl, the approval engine (ported from `app/src/domain/rules`, tested against the same `contracts/test-vectors`), requests, objection windows, the setup phase and the lock-out guard. The operator deploys it with the founder as its only member and holds no role.
- **`ancora_registry`** (`contracts/registry`): profiles (name, picture URL) and the organizations per person, so any device finds everything with one read. Organizations update the membership index themselves (direct-invoker auth).
- **Policy document**: each organization's rules are one canonical JSON document (`app/shared/policyDocument.ts`, with the rules' home currency); the contract stores its SHA-256 at creation and with every rule change, the Rules page verifies it.
- **Several stablecoins**: an organization accepts a list of tokens (BlendUSDC and Circle USDC on testnet, from the `ORG_ASSETS` allowlist), each with its own balance, payments and test money; accepting or dropping one is a governance change. Payments in an asset of another currency than the rules take the strictest tier and the seal.
- **App**: passkey sign-in/sign-out, profile page ("your pass"), invites by ancora ID, commands signed through the person's account (`execute`), "Send now" for due requests via the operator, reads by simulation, 30 s refresh.
- **Follow-ups**: live FX rate from the Reflector oracle (SEP-40) so payments in another currency hit the right tier; EURC on testnet (Circle issuer, one `ORG_ASSETS` line plus an operator float); template switching on-chain; cumulative crew limits through OZ `spending_limit` installed on the organization's context (task 9); Perch-style IR for function-level constraints once needed.

### Task 7 as built: the Reserve

- The organization contract deposits into and withdraws from the asset's DeFindex vault itself (`move_to_reserve`, `withdraw_from_reserve`); the top role or any strictest-tier approver may do it, no request needed. The vault's token pull is authorized as a sub-invocation.
- `reserve(token)` reports shares, value and principal; the app shows the value and "earned so far" per asset. Assets without a vault (Circle USDC today) show "No Reserve yet".
- Follow-ups: auto-sweep rules (keep X on the account, rest in the Reserve), more vaults as DeFindex adds them on testnet, the confidential split (task 14).

### Task 8 as built: the quantum-safe seal verifier

- `contracts/seal_verifier`: ML-DSA-44 (FIPS 204) verification in a 15 KB Soroban contract with OpenZeppelin's external-verifier interface; shared vector from `@noble/post-quantum`; deployed once by the setup script and checked on-chain (valid → true, tampered → false).
- Still to do (SCF milestone): generate the ML-DSA key on the approving device, store it in the browser's IndexedDB (non-extractable where the platform allows), add it to the person's smart account as an external signer on a context rule that only covers `seal`, and sign the seal with it; swap the verifier body for the native host function after Protocol 30.

### Task 16: discussions on approval requests

Approvers decide better when the reasons are visible next to the request.

- **Thread per request** (payments and membership/rule changes). Entry types: *pro reason*, *contra reason*, *question*, *comment*. Questions can be marked answered by the requester.
- **Reactions:** thumbs up / thumbs down on reasons; one reaction per person per entry, changeable; never on your own entry. Shows which arguments the group actually backs.
- **Who:** members of the organization only. Posting doesn't count as approving, so four-eyes and the approval rules stay untouched.
- **UI:** discussion section on the request page; summary on request cards and in the inbox ("2 pro · 1 contra · 1 open question"); notice when someone replies to your request.
- **Storage:** the text is off-chain (not money, should stay private to the org). It goes behind the `DataSource` interface: sample adapter first, then a minimal Vercel-integrated store justified in DECISIONS.md. Optionally each approval records the hash of the discussion it was given on, so later readers can prove what an approver saw.
- **Later:** attachments (receipts, quotes) via Vercel Blob, @mentions, a requester-written decision summary.

### Task 17: recovery ("Lifeline")

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

- Switch the security seal from the in-contract ML-DSA verifier to the native ML-DSA host function after Protocol 30 "Bell" (mainnet vote 23 Nov 2026).
- Lifeline in full (inactivity path, succession plans, professional guardians).
- Licensed ramp partner integration (EUR IBAN/SEPA, USD/ACH) in production mode.
- Security review of the organization, registry and recovery contracts; mainnet readiness.

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
