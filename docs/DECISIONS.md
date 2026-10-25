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
