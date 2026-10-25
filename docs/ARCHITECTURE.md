# Architecture

> Living document. Sections marked *(planned)* describe the target design and are filled in as each task lands.

## What runs where

```mermaid
flowchart LR
  subgraph Vercel["One Vercel project (root: app/)"]
    SPA["PWA: landing /, app /app/*, /admin"]
    API["Vercel Functions /api/*<br/>(relayer proxy, ramps, admin, logo upload)"]
  end
  Browser["Browser / installed PWA<br/>passkeys (WebAuthn)"] --> SPA
  SPA --> API
  SPA --> RPC["Stellar testnet RPC"]
  API --> RPC
  API --> Blob["Vercel Blob (logos)"]
  RPC --> Contracts["Soroban contracts<br/>OZ smart account per org, policies, verifiers"]
```

- **Static app**: Vite build served by Vercel; every path except `/api/*` rewrites to `index.html` so deep links survive refresh. A Workbox service worker precaches the shell for installability and offline start.
- **Server-side** (`app/api/`): thin handlers calling adapters. Secrets live only in Vercel environment variables.
- **Source of truth**: the Stellar testnet (accounts, rules, requests, balances). No database by default (see DECISIONS.md).

## Front-end layering

`app/src/domain` (pure) ← `app/src/adapters` (outside world, behind interfaces) ← `app/src/features/*` (UI) using `app/src/ui` (presentational) and `app/src/styles/tokens.css` (design tokens).

## Approval rules engine

Pure TypeScript in `app/src/domain/rules/`, no I/O:

| Module | Responsibility |
|--------|----------------|
| `model.ts` | Org, roles (ranked, 0 = highest), members, policy (tiers, seal threshold, new-recipient rule), errors |
| `templates.ts` | Club, company and team defaults |
| `policy.ts` | Policy validation; payment evaluation (tier, required approvals, objection window, seal); governance evaluation (strictest tier) |
| `approvals.ts` | Slot matching: requester excluded, one slot per person, higher roles fill lower slots |
| `requests.ts` | Request lifecycle: pending → scheduled (objection window) → ready → executed, or declined |
| `governance.ts` | Member/rule/template changes, setup phase, template switching by rank, lock-out guard |

The same behaviour is pinned by `contracts/test-vectors/approval-rules.json`, which the Soroban contracts will test against too (task 6).

## Data sources

Features never talk to the outside world directly. They use one `DataSource` interface (`app/src/domain/dataSource.ts`): a snapshot of the person's workspace plus commands (request payment, approve, seal, decline, propose change, move to/from Reserve, set logo, create organization).

| Implementation | Where | Status |
|----------------|-------|--------|
| `SampleDataSource` | `app/src/adapters/sample/` | Labeled sample data; every command runs through the domain engine; persisted in browser storage. Stays as the demo fallback. |
| Testnet adapter | `app/src/adapters/testnet/` | `testnetConfig.ts` reads the public IDs from `app/.env.testnet` (Vite `--mode testnet`). The adapter itself lands in task 4: smart accounts, contracts and the relayer on Stellar testnet. |

UI state lives in `features/workspace` (snapshot via `useSyncExternalStore`, preferences, active org). `useCommand` gives every action the same UX: signature prompt → command → plain-language success or error.

## Contracts *(planned)*

One OpenZeppelin smart account per organization; everything else is a module on it: signers (passkeys, ML-DSA via external verifier), policies (approval rules, spending limits), connected contracts (DeFindex vault, confidential token). Shared stateless verifiers; multi-tenant policies keyed by smart account + context rule.

## Auth flows *(planned)*

Passkey (WebAuthn) signatures verified by the smart account; fees sponsored by a relayer so users never hold XLM.

## Multi-tenancy *(planned)*

One person, many organizations, a role per organization; full isolation between orgs.
