# Roadmap

Status legend: **Real on testnet** · **Simulated** (labeled sample data in the UI) · **Roadmap**.

## Now: HackMeridian 2026 (deadline 26 Oct 2026, 12:00 Lisbon)

| # | Task | Status |
|---|------|--------|
| 0 | Scaffold: PWA app shell, routing, tokens, CI, docs, Vercel | Done |
| 1 | Approval rules engine (pure TS, tested) | Done |
| 2 | App screens on sample data behind the data-source interface | Done |
| 3 | Testnet setup script (keys, contract deploys, IDs) | Next |
| 4 | Passkey smart accounts + fee-sponsoring relayer | Planned |
| 5 | Demo admin: data-source fallback switch + health panel | Planned |
| 6 | Approval rules on-chain (OZ policy + request contract, shared test vectors) | Planned |
| 7 | Reserve on DeFindex testnet vault + chunked public/confidential split | Planned |
| 8 | Security seal: ML-DSA verifier as OZ external signer (timebox 2h) | Planned |
| 9 | Crew / agent keys with OZ spending-limit policy | Planned |
| 10 | Euro in/out: SEP-24 test anchor (real), Bridge (simulated) | Planned |
| 11 | Organization logo: Vercel Blob + org-registry contract | Planned |
| 12 | Budgets and bookkeeping | Planned |
| 13 | Demo admin: reset, top-up, retry stuck requests | Planned |
| 14 | Confidential pot + auditor view stub | Planned |
| 15 | Integrate the Claude Design package | Waiting for /design |

## Next: SCF #46 milestones

- Switch the security seal from the in-contract ML-DSA verifier to the native ML-DSA host function after Protocol 30 "Bell" (mainnet vote 23 Nov 2026).
- Personal smart account per person, added to orgs as a Delegated signer.
- Licensed ramp partner integration (EUR IBAN/SEPA, USD/ACH) in production mode.
- Security review of the policy and request contracts; mainnet readiness.

## Later

- Confidential payments with auditor view (OZ Confidential Token, once zk proof verification is available).
- x402 agent payments (open SCF RFP for an x402 facilitator).
- Cards.
- Sub-accounts via Protocol 30 muxed contract addresses.
