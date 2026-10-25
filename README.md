<p align="center">
  <img src="app/public/brand/mark.svg" width="96" height="96" alt="ancora mark: an anchor whose ring is a star" />
</p>

<h1 align="center">ancora</h1>

<p align="center">
  A finance account for any organization that feels like a modern banking app and runs on Stellar in the background.<br/>
  Organizations set their own rules; the account enforces them.
</p>

<p align="center">
  <strong>Live demo:</strong> <a href="https://ancora-gray.vercel.app">ancora-gray.vercel.app</a> · <strong>Demo video:</strong> <em>coming soon</em> · Built for HackMeridian 2026, Lisbon
</p>

> ancora is not a bank. Balances are not deposit-insured. This project runs on the Stellar **testnet** only.

## Problem

Organizations want to use stablecoins, but no treasurer puts company money in an account that's lost with a seed phrase, earns nothing, and could be cracked by a quantum computer in ten years.

## Solution

One OpenZeppelin smart account per organization, with everything else as a module on it:

- **Passkeys instead of seed phrases**: Face ID or a fingerprint; fees are sponsored, nobody touches XLM.
- **Approval rules enforced on-chain**: tiers per amount, four-eyes, objection windows, extra approval for new recipients.
- **Reserve**: idle money earns variable earnings in a DeFindex vault, with auto-sweep.
- **Security seal**: large payments need a quantum-safe ML-DSA signature.
- **Crew and agent keys** with hard spending limits.
- **Euro and dollar in and out** through a licensed ramp partner.

## Features

| Module | What it does | Status |
|--------|--------------|--------|
| App shell | Installable PWA, desktop sidebar + mobile tabs, light/dark, org switcher, cross-org inbox | Real |
| App screens | Overview, Inbox, Approvals, Send money with live rule preview, Rules, Settings, New organization | Real UI on **Simulated** sample data (testnet adapter: task 4) |
| Passkey prompts | Confirm every action with Face ID / fingerprint | **Simulated** (real WebAuthn: task 4) |
| Approval rules | Tiered approvals, four-eyes, objection window, seal threshold, membership requests | Engine done (TypeScript, tested against shared vectors); on-chain: task 6 |
| Passkey smart accounts | WebAuthn signers, sponsored fees | Roadmap (task 4) |
| Reserve on DeFindex | Variable earnings on idle funds, one-tap moves | **Simulated** in the UI; DeFindex vault: task 7 |
| Security seal (ML-DSA) | Quantum-safe approval above a threshold | Roadmap (task 8) |
| Crew / agent keys | Per-key spending limits | Roadmap (task 9) |
| Euro in/out | Account number card (IBAN); SEP-24 test anchor; Bridge | **Simulated** IBAN card; real ramps: task 10 |
| Confidential payments | Hidden amounts with auditor view | Roadmap (task 14) |

The full plan is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Architecture

```mermaid
flowchart LR
  Browser["PWA + passkeys"] --> App["Vercel: app + /api functions"]
  App --> RPC["Stellar testnet RPC"]
  RPC --> SA["OZ smart account per org"]
  SA --> Policies["Approval & spending policies"]
  SA --> Verifiers["Passkey / ML-DSA verifiers"]
  SA --> Vault["DeFindex vault (Reserve)"]
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)

## Testnet contracts

None yet; they are added with task 3.

## Run locally

```bash
cd app
pnpm install
pnpm dev          # http://localhost:5173
pnpm verify       # format/lint, typecheck, tests, build: same as CI
```

Requirements: Node 24, pnpm 10. Contracts (from task 3 on): Rust 1.90 with the `wasm32v1-none` target and the Stellar CLI.

## Deploy

A single Vercel project, Root Directory `app`, deploys production from `main` through the Git integration. `app/vercel.json` rewrites every non-API path to the SPA so that deep links work. Environment variables are documented in `app/.env.example`.

Production domain: `ancora-gray.vercel.app`. Passkeys are bound to it: the WebAuthn RP ID is `ancora-gray.vercel.app`, so passkeys created on preview URLs or localhost will not work in production.

## Limitations

- Testnet only, so nothing here holds real money.
- Anything labeled **Simulated** in the app uses sample data and is labeled the same way here. Right now the whole app runs on sample data (a purple banner says so); sample state is stored in your browser.
- In sample mode, "Viewing as" (Settings) switches between sample people so you can approve requests from each side. On testnet this is replaced by passkey sign-in.

## License

To be decided.
