# ancora Deals (`contracts/deal`)

Milestone escrow between two parties, usually two ancora organizations. One instance holds every
deal; each deal lives under its own storage key.

## Lifecycle

```
Draft ──accept──▶ Accepted ──fund──▶ Funded ──request_release──▶ Active ──(all paid)──▶ Completed
  │                  │                  │                          │
  └──cancel (A)──────┴──▶ Cancelled ◀───┴──cancel (A and B)────────┤
                                         └──dispute──▶ Disputed ──resolve──▶ Resolved
```

Per milestone: `Open ──request_release──▶ Requested ──approve_release / execute_release──▶ Released`;
`object` within the period turns `Requested` into `Objected`, from where B may ask again and A may
still approve.

| Function | Who | What happens |
|---|---|---|
| `create(party_a, party_b, terms)` | A | Terms: asset, 1–20 milestones, objection period (1 minute–90 days), optional arbiter (not a party), SHA-256 of the documents |
| `accept(id)` | B | Agrees to the terms |
| `fund(id)` | A | Deposits the total into the deal contract |
| `request_release(id, m)` | B | Marks a milestone done; the objection period starts |
| `approve_release(id, m)` | A | Pays B at once |
| `object(id, m)` | A, within the period | Stops the automatic payout |
| `execute_release(id, m)` | anyone, after the period | Pays B (the money can only go to B) |
| `cancel(id, by)` | A before funding; A **and** B after | Returns what is left to A |
| `dispute(id, by)` | A or B, if an arbiter was named | Stops payouts until the ruling |
| `resolve(id, to_a, to_b)` | the arbiter | Splits exactly what is left between A and B |

Views: `deal`, `deals_of(party)` (newest first), `quote(id, milestone)` (asset and amount, for a
party's own rules). Every status change emits `DealEvent { name, id, status, milestone }` with the
names `deal_created`, `accepted`, `funded`, `release_requested`, `released`, `objected`,
`cancel_asked`, `cancelled`, `disputed`, `resolved`.

## Two levels of approval

- **Between the parties (level 1):** each step calls `require_auth` on the party whose consent it
  needs. Cancelling a funded deal stores each party's request in the deal, so internal approvals
  may take days.
- **Inside each organization (level 2):** an ancora organization has no signer of its own. Its
  `require_auth` is met only when the organization contract itself makes the call, which it does
  once its own rules approved a `DealCall` request (`contracts/organization/src/deals.rs`):
  depositing is weighed like a payment of the total and holds that money back while it waits,
  approving a payout like a payment of the milestone, everything else like a rule change. For the
  deposit it also authorizes the token transfer the deal contract pulls. The deal contract never
  repeats those rules. `organization/src/test_deals.rs` proves it with two real organizations.

Any other Stellar account can be a party too; then its own signature is the consent.

## Security assumptions

- **No admin, no upgrade, no freeze.** Nothing in the contract lets ancora (or anyone but the
  parties and the arbiter) move funds. A new version is a new deployment, published on the
  Stellar Registry as `ancora-deal`; running deals stay where they are. Upgrades approved by both
  parties of every deal would be possible but are left out on purpose: with many deals per
  instance, no single pair of parties could approve one.
- **No double payouts:** a milestone is marked paid before the transfer; `paid_out` never passes
  `total`; every step checks the deal's and the milestone's status.
- **The arbiter** can only split what is left between A and B, in full.
- **Lifetime:** deals are persistent entries extended by 120 days on every action. A deal nobody
  touches for months can be archived and must then be restored before the next step.
- **Time:** the objection period uses the ledger's timestamp.

## Not in this version, and how they fit

`Deal.kind` is `MilestoneEscrow` today. Netting (a running account between two parties), delivery
versus payment (an atomic swap of two assets) and shared pots become further kinds with their own
state next to it; the lifecycle functions check the kind, so milestone deals never change. A fiat
payout belongs to the licensed partner after the stablecoins reach B.

## Open points

- Counterparties by ancora name (Stellar Registry) instead of address.
- A deal with a non-ancora party has no internal rules on that side.
- The documents stay off-chain; only their hash is recorded (see docs/ROADMAP.md for encrypted
  storage).
- No fee for the arbiter yet.

## Build, test, deploy

```bash
cd contracts && cargo test -p ancora-deal          # lifecycle, errors, automatic payout, auth
cargo test -p ancora-organization test_deals       # two real organizations as parties
stellar contract build && scripts/setup-testnet.sh # deploys the deal contract once (VITE_DEAL_CONTRACT)
```
