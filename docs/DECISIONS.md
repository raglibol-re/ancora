# Decision log

| Date | Decision | Why | Alternatives considered |
|------|----------|-----|-------------------------|
| 2026-10-25 | One Vercel project, Root Directory `app/`, serving landing, app, admin and API routes | One domain for passkeys (stable RP ID), one deploy pipeline | Separate landing / API projects |
| 2026-10-25 | No pnpm workspace; `app/` is a standalone package, `contracts/` is Cargo-only | Nothing is shared between JS packages yet; keeps Vercel and CI simple | Root pnpm workspace |
| 2026-10-25 | No database | Testnet is the source of truth; logos go to Vercel Blob; UI preferences to the browser | Vercel-integrated Postgres/KV |
| 2026-10-25 | `vite-plugin-pwa` (Workbox) for manifest + service worker | Maintained, standard; avoids a hand-written service worker | Hand-written SW |
| 2026-10-25 | Theme tokens use CSS `light-dark()` with `color-scheme` | Each color defined once; `[data-theme]` override needs no duplicated dark block | Duplicated dark values under media query + attribute |
| 2026-10-25 | Fonts self-hosted via `@fontsource` | Works offline in the PWA; no third-party font requests | Google Fonts CDN |
| 2026-10-25 | Biome as the single formatter + linter | One fast tool, zero-warning policy is easy to enforce | ESLint + Prettier |
| 2026-10-25 | Production domain `ancora-gray.vercel.app` (passkey RP ID) | `ancora.vercel.app` is taken; the RP ID must stay stable or existing passkeys stop working | Custom domain later (would require re-enrolling passkeys) |
| 2026-10-25 | A higher role can fill a lower role's approval slot (treasurer counts as a board member, lead as a member) | Otherwise the club treasurer and company finance role could never approve anything; matches "at least" intuition | Exact-role matching only |
| 2026-10-25 | New-recipient approvals merge per role by keeping the higher count (spec wording), not by adding | Spec says "merge per role, keep the higher count"; so for the company, the new-recipient director only changes tier 0 | Additive (+1 on top of the tier) |
| 2026-10-25 | The strictest tier is the last tier; governance (members, rules, template) uses it without the seal | Templates are monotonic; one clear definition that the contract can mirror | Computing the "largest" requirement set |
| 2026-10-25 | Setup phase = the founder's own change requests could never complete (strictest tier unsatisfiable without the founder); founder-only, covers all governance changes | Mirrors choosing initial signers at account creation; also lets a lone founder adjust rules before inviting people | Member additions only; any member |
| 2026-10-25 | Changes that would make the strictest tier unsatisfiable are refused ("would lock the account") | Prevents an org from locking itself out of its own funds | Allow and warn |
| 2026-10-25 | Requests snapshot their evaluation at creation | Predictable for approvers; rule changes don't retroactively alter requests in flight | Re-evaluate on every approval |
| 2026-10-25 | Shared test vectors as JSON in `contracts/test-vectors/` | One language-neutral source both the TS engine and the Rust contracts test against | Duplicated fixtures per language |
| 2026-10-25 | One `DataSource` interface (snapshot + commands) with a sample adapter that runs every command through the domain engine | Features stay identical when the testnet adapter lands; sample mode is a faithful demo fallback, not a mock | Separate mock UI; per-feature fetchers |
| 2026-10-25 | Sample state persisted in localStorage; a "Viewing as" person switcher in sample mode | Demo survives reloads and shows both sides of four-eyes approval; replaced by passkey sign-in on testnet | In-memory only; fake login |
| 2026-10-25 | Moving money between the main account and the Reserve needs no approval; allowed for the top role and anyone who can approve the strictest tier | Money never leaves the organization; one-tap UX | Treat as a payment with approvals |
| 2026-10-25 | Requests get a `failed` status with a reason | Execution can fail (network, change no longer applies); demo admin retries it (task 13) | Reuse `declined` |
| 2026-10-25 | Logos resized in the browser to 256×256 WebP and kept in the sample state until Vercel Blob + org registry (task 11) | Same validation and UX now; storage swaps later | Wait for Blob before building the UI |
