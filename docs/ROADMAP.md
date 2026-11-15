# Roadmap

ancora is a public preview on the Stellar testnet: every feature below runs on ancora's own contracts with test money. The next stage is mainnet with pilot organizations (clubs, NGOs, small companies), along the milestones under [Path to mainnet](#path-to-mainnet). Operational state and short-term open work are in [HANDOFF.md](HANDOFF.md); how it is built is in [ARCHITECTURE.md](ARCHITECTURE.md).

Status legend: **Real on testnet** (ancora's contracts, test money) · **Preview** (real on testnet, labelled preview, not audited) · **Simulated** (labelled sample data in the UI).

## Where it stands

The first version was built for HackMeridian 2026 (submitted 26 Oct 2026). Everything since is listed in [CHANGELOG.md](../CHANGELOG.md); the README feature table has the details per module.

| Area | Delivered | Status |
|---|---|---|
| Accounts and recovery | Passkey accounts (one OpenZeppelin smart account per person) | Real on testnet |
| | Second passkey on the same account, reminder until one exists | Real on testnet |
| | Lifeline: guardians hand a person's positions to a new pass | Real on testnet; Simulated in sample data |
| | Succession per member after a quiet period | Real on testnet (release 0.9.0) |
| Rules and approvals | Tiered approvals, four-eyes, objection windows, setup phase, lock-out guard | Real on testnet |
| | Custom roles, spending limits for members and agent keys | Real on testnet |
| | Budgets per category (soft or hard), allowances per asset or category, recipient allowlists | Real on testnet (allowances: release 0.8.0) |
| | Reflector exchange rates for other-currency payments | Real on testnet (release 0.8.0) |
| | Quantum-safe seal: ML-DSA-44 key on the approving device, checked on-chain | Real on testnet (release 0.9.0) |
| Payments | Payments in several stablecoins, address book | Real on testnet |
| | Batch payments (up to 50 lines, CSV import), standing orders | Real on testnet |
| | Payment links and QR codes, paid from any Stellar wallet | Real on testnet |
| | Secure handover (escrow released when both sides confirm) | Real on testnet |
| | Deals between organizations (milestone escrow) | Real on testnet (release 0.8.0) |
| | Bank in and out through SEP-24 with the SDF test anchor | Real on testnet; euro IBAN card Simulated |
| Treasury | Multi-asset balances, any SEP-41 token by reference | Real on testnet |
| | Reserve in a DeFindex vault | Real on testnet for BlendUSDC; Simulated in sample data |
| | Money view in the home currency | Display rates real; fallback rate Simulated |
| | Confidential pot (hidden amounts, OpenZeppelin confidential token) | Preview |
| Privacy and security | Encrypted references, batch lines, standing orders, discussions and recipient names | Real on testnet |
| | Auditors with a read-only Audit page and CSV | Real on testnet |
| | Device keys from a backup code or the passkey (PRF) | Real on testnet |
| | Fail-closed fee relayer for ancora's own contracts only | Real on testnet |
| Collaboration | Discussions on requests (reasons, questions, reactions) | Real (off-chain, Postgres) |
| | Web push notifications | Real on testnet |
| | Activity, search, monthly statement, CSV | Real on testnet |
| Platform and operations | Contract releases on the Stellar Registry, governed upgrades | Real on testnet (organizations from 1 Nov 2026) |
| | Organization names on the Stellar Registry | Real on testnet |
| | Channel accounts for server transactions | Real on testnet |
| | Hourly live check, eleven end-to-end flows nightly, nightly encrypted backup | Real |
| | English and German | Real |
| | Sample data as fallback | Simulated |

## Path to mainnet

### SCF #46 milestones

The plan prepared for the Stellar Community Fund #46 round (8 Nov 2026). Weeks count from the award; the budget per milestone is set in the application.

Starting point (2 Nov 2026), real on testnet and open source under Apache-2.0:

- Everything in [Where it stands](#where-it-stands) that predates 2 Nov, including custom roles, the address book, push notifications, statements, batch payments and payment links.
- Organizations move to new releases through their own rules (published on the Stellar Registry).
- Channel accounts for server transactions.
- Allowances, recipient allowlists and Reflector exchange rates.
- Deals between organizations.
- Lifeline succession and ML-DSA seals checked by the contract.
- Private details: encrypted references and recipients, auditors, backup codes, passkey-derived keys.
- A confidential pot preview on OpenZeppelin's confidential token, with ancora's own browser client.
- Coverage: eleven end-to-end flows against production every night (core, approvals, deals, seals, privacy, pot, money, Lifeline, second passkey, registry name, first path in German).

#### M1: proven on testnet (weeks 1–6)

| Deliverable | Done when |
|---|---|
| Nightly end-to-end coverage of every flow: the eleven nightly flows (Lifeline claims included) plus secure handover, payment links paid by a payer and a governed upgrade | Each flow green for 14 nights in a row against production |
| Reproducible, attested builds: pinned toolchain, a build container, the Stellar Registry's GitHub attestation action. Today rebuilds give new hashes, so organizations see "upgrade available" for unchanged code | Two independent builds of a release give the same hash; Settings shows the attestation |
| Rate limits on every function, error tracking, an alert drill (uptime and float checks run hourly since 1 Nov) | Ten simultaneous server transactions settle within two ledgers; an alert fires in a drill |
| History beyond the RPC's one-week window: a durable event archive (Mercury or SubQuery) behind `orgHistory.ts` and the pot's event reader | A device away for a month, or a new one, sees the full activity and reads the pot |

#### M2: privacy and keys beyond preview (weeks 7–14)

| Deliverable | Done when |
|---|---|
| Confidential pot out of preview: the event archive, the pot auditor key shared with outside auditors, spender delegation (a standing order paid from the pot), OpenZeppelin's final proving recipe (zero-knowledge mode once the verifier supports it) | An auditor reads a pot's payments on the Audit page; the pot E2E runs on the final recipe |
| Approval tiers for hidden amounts (privacy phase C, first step): a range proof that a confidential payment is below a tier's limit, checked by the organization | A confidential payment under the first tier runs without approvals, proven, not revealed |
| Lifeline check-in reminders (push) on top of succession; the native ML-DSA host function replaces the in-contract verifier once Protocol 30 reaches testnet and mainnet | A quiet member is reminded before a successor can claim; seals verify through the host function |
| Perch step 1: ancora's rules document in perch's IR where it fits | Document and mapping published; upstream proposal for `i128` range predicates and asynchronous approvals |

#### M3: ready for mainnet (weeks 15–24)

| Deliverable | Done when |
|---|---|
| External security review of the organization, registry, recovery, deal, keyring and pot contracts and the pot's browser client; threat model for the relayer, the wallet index and the off-chain database | Report published in `docs/`; every finding fixed or answered |
| Mainnet profile: network settings per environment, operator key in a KMS, fee budget with alerts, backups of the off-chain database | Contracts deployed on mainnet from attested releases |
| Licensed ramp partner (EUR IBAN/SEPA) in production mode; MoneyGram Access for cash as a second SEP-24 home domain in `anchorRamp.ts`; terms, privacy and the "not a bank" wording reviewed | A pilot organization moves euros in and out through the partner |
| Pilot organizations (clubs, NGOs, small companies) on mainnet | Pilots run their real payments under their own rules; feedback folded into the roadmap |

## Before mainnet

Gaps measured against Revolut Business for everyday banking and Squads (Solana) and Safe (EVM) for treasury governance. Each list is in priority order.

### Trust and safety

1. **External security review** of every contract and the pot client, with a threat model for the relayer, the wallet index and the off-chain database (M3).
2. **End-to-end coverage** of the remaining flows (M1). Playwright with Chromium's virtual WebAuthn authenticator already drives eleven flows nightly; it is the main quality lever.
3. **Mainnet profile:** network settings per environment, the operator key in a KMS instead of a Vercel secret, a fee budget with alerts, rate limits on every function, storage migrations between contract releases.
4. **Monitoring:** error tracking for the app and the functions. The hourly live check (`scripts/check-live.mjs`) already covers uptime, the RPC, test money and the operator's XLM float.
5. **Legal and partners:** KYB and fiat through a licensed partner (euro SEPA anchor, MoneyGram Access for cash), terms and privacy, the "not a bank" wording reviewed per jurisdiction.

### Everyday banking

1. **Notifications:** money received (needs ledger events, not the relayer), a refused standing order, email through a partner.
2. **Receipts and attachments** per payment (off-chain, hash on the request); opening balances once full history is indexed.
3. **Reimbursement claims** by members, on top of batch payments.
4. **Payment links:** reminders, card and bank payment through a ramp partner, a notification when a link is paid.
5. **Sub-accounts:** pots per project or team with their own budgets and views.
6. **Exchange in the app:** EURC to USDC through path payments with a quote (Reflector or SDEX) and a rule-aware preview.
7. **Languages and access:** Portuguese, a WCAG AA audit, an onboarding tour, help pages, skeleton states while the chain is read.

### Treasury governance

1. **Any action under the rules:** approve calls to allowlisted contracts with a simulation preview, as in Safe's transaction builder. Today only payments, deals, pot actions and governance changes.
2. **More policy:** velocity limits for the whole organization, emergency freeze by a quorum, time locks per tier (the objection window exists), template switching on-chain.
3. **Keys:** hardware security keys tested through the passkey flow, moving and backing up the ML-DSA seal key, passkey re-authentication for sensitive actions.
4. **Lifeline:** reminders before a claim (M2), professional guardians.
5. **Integrations:** signed audit-log export, webhooks, an SDK, accounting exports (DATEV, QuickBooks).

### Platform

1. **Releases:** attested builds (M1); organizations deployed by name from the Stellar Registry instead of the operator's uploaded hash.
2. **Preferences across devices** through the profile store, and a settings page that explains every switch.

### Off-chain records

Since 12 Nov 2026 every off-chain record is in one Neon Postgres database (DECISIONS, 2026-11-12). Open:

1. **Backups:** a copy outside GitHub and a restore drill on a schedule. The nightly encrypted export and a first restore drill exist ([ARCHITECTURE, Backups](ARCHITECTURE.md#backups)).
2. **Read from the chain instead of a table:** the scheduler's organization list and the registry names (the registry is the source).
3. **Records from the former Blob store:** the organization list and the one recorded registry name were copied on 15 Nov. Discussions and push subscriptions started empty (testnet preview data). Pictures uploaded before 12 Nov keep their Blob URLs on-chain and show initials once that store is deleted, until uploaded again.

### Privacy

What is public on Stellar stays public: amounts of ordinary stablecoin transfers, who pays whom, timing, the fee payer (research of 1 Nov 2026, see DECISIONS).

| Phase | Scope | Status | Open |
|---|---|---|---|
| A | Encrypted details with an organization key per epoch, wrapped per member in `contracts/keyring`; auditors; device keys from a backup code or the passkey | Real on testnet | An auditor's view key |
| B | Confidential pot on OpenZeppelin's confidential token | Preview | Durable event archive (a device that never read the pot needs a payment within the RPC's week), spender delegation, the organization's auditor key shared with outside auditors, an audit |
| C | Approval rules over hidden amounts (custom circuits for tiers and budgets) | Research | Range proof for tiers first (M2); the full scope takes months plus an audit |

## Later

- **Non-fungible holdings:** membership cards, certificates and tickets as OpenZeppelin NonFungible tokens held next to the stablecoins. They have no amounts, so they bypass the tiers and transfers go through governance.
- **Reserve:** a DeFindex vault per stablecoin as they appear on testnet (today only BlendUSDC has one); auto-sweep rules (keep an amount on the account, the rest in the Reserve).
- **Deals:** counterparties by ancora name, netting, delivery versus payment, shared pots (`contracts/deal/README.md`).
- **Discussions:** attachments (receipts, quotes), @mentions, a decision summary by the requester, passkey-signed entries, and approvals that record the hash of the discussion they were given on.
- **Lifeline:** an offline recovery kit, later an offline ML-DSA recovery key; a professional guardian service.
- **Declarative policy IR** in the style of stellar-registry/perch for per-call constraints (function, argument ranges), lowered onto the organization contract's rules.
- **Sub-accounts** through Protocol 30 muxed contract addresses.
- **x402 agent payments** (open SCF RFP for an x402 facilitator).
- **Cards.**

## Design notes

Details of the current design that [ARCHITECTURE.md](ARCHITECTURE.md) does not cover.

### Spending limits and agents

- A payment inside the requester's remaining allowance executes at once; beyond it, or in another currency, the normal rules apply.
- An agent is a member whose key has a limit. Any address that can authorize can be added.
- The Rules page shows what is left per person and lets the top role edit limits; the Send page says when a payment fits.

### Budgets and other currencies

- Inside what is left, a payment follows its own tier.
- Payments in another currency can't be measured against a budget: a soft budget flags them, a hard budget refuses them.

### Rules document and perch

- The rules document uses perch's canonical form so the same bytes can later be read by that toolchain. The Rules page says which document version matched (v3, or v2 for older organizations).
- Perch (testnet beta, pre-audit) models per-signer rights on a smart account and can't express role tiers, asynchronous approvals or budgets, so the organization contract stays the evaluator (DECISIONS).

### Bank in and out

- Deposits land in the person's wallet and move on to the organization through the normal wallet funding.
- A withdrawal turns the anchor's instructions (account and reference) into a payment request from the organization, so it follows the rules.
- Verified: the protocol end to end with a keypair. Not yet verified: the anchor's hosted form in a browser session, and the anchor's payout after the organization pays.
- A euro anchor or Bridge needs KYB and comes with the licensed partner.

### Discussions

- One thread per request (payments and membership or rule changes). Entry types: pro reason, contra reason, question, comment; the requester marks questions answered.
- Thumbs up or down on reasons: one reaction per person per entry, changeable, never on one's own entry. It shows which arguments the group backs.
- Members only. Posting doesn't count as approving, so four-eyes and the approval rules are untouched.
- The text stays off-chain: it is not money and should stay private to the organization.

### Lifeline

As built:

- The person's smart account itself is not recovered: that needs a contract signer on the OpenZeppelin account, which the kit's accounts don't accept yet. The positions are.
- Waiting period: at least a minute in the contract, two minutes to thirty days in the app.
- Money never moves. Approvals already given stay under the old ID as history.
- In the app: the Lifeline card on the pass page (status, plan editor, open-claim warning with cancel, a banner across the app), "People you protect" for guardians, "Recover an old pass" on the new pass.

Target design for the open parts:

- Recovery restores control, never moves money, and any current signer can always cancel.
- Guardians can be people, second devices, an offline recovery kit, or professionals (auditor, tax advisor). Onboarded by invite link with a passkey; fees sponsored.
- Waiting period: default 7 days, configurable, longer for larger balances. All signers are notified when a claim starts.
- OpenZeppelin context rules scope by contract, not by function, so guardians must not get a rule on the account itself. Only the recovery contract is authorized on the account (a `CallContract` rule), and its code can only swap signers after the delay. Temporary guardians and successors use context-rule expiry (`valid_until`).
- Claims, cancellations and handovers emit events for the activity feed and the admin health panel.
- UI wording: on-chain recovery supports, but doesn't replace, legal processes (board elections, register entries, proof of inheritance).

### Recovery devices

- Recommended order in onboarding: create a passkey, create or join an organization, add a recovery device, choose guardians, with a visible recovery status ("Protected: 2 devices, 2 guardians" / "Not protected yet").
- Recommend a recovery device from a different ecosystem: synced passkeys don't help when the Apple or Google account is lost. A hardware security key also works.
- Adding one's own recovery device needs only the existing passkey and covers every organization at once.

### Seal verifier

- `contracts/seal_verifier` is a 15 KB contract implementing OpenZeppelin's external-verifier interface, tested with a shared vector from `@noble/post-quantum` and checked on-chain (valid signature: true, tampered: false).

### Confidential pot

- OpenZeppelin ships no JavaScript client, so ancora wrote one to the OZ SDK specification; Grumpkin and Poseidon2 match every OZ vector.
- The npm builds of the pinned toolchain reproduce OZ's verification keys byte for byte.
- A proof takes about 2 s in Node and about 77M instructions to verify (limit 400M).
- The pot key travels in the keyring, like private details.
