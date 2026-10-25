# Changelog

- 2026-10-25: Scaffold: PWA app shell (landing, /app screens, /admin), design tokens, placeholder brand mark and icons, CI, docs, Vercel config.
- 2026-10-25: Approval rules engine (pure TypeScript): tiers, four-eyes, objection window, seal, new-recipient rule, membership/rule requests, setup phase, template switching; shared test vectors.
- 2026-10-25: App screens on labeled sample data: overview, cross-org inbox, approvals with request pages, send money with live rule preview, rules editor, settings (logo, theme, expert mode, install, viewing as), new organization, org switcher, simulated passkey and seal prompts.
- 2026-10-25: Roadmap: discussions on approval requests (pro/contra reasons, questions, thumbs up/down).
- 2026-10-25: Testnet setup script (deployer key, BlendUSDC float via Blend faucet, verification of DeFindex and smart-account-kit deployments, app/.env.testnet); expert-mode list of testnet deployments in Settings.
- 2026-10-25: Final brand from the Claude Design handoff: shield-and-anchor mark, lockups, size-cut PWA/iOS icons and favicons, brand tokens (Brass Deep, accent text, dark surfaces, greens/reds); design package stored in /design.
- 2026-10-25: Passkey smart accounts on Stellar testnet (smart-account-kit 0.8.0): create organization deploys an OZ smart account, test USDC from the operator, payments signed with the passkey; fee-sponsoring relayer `/api/relay` (self-funded, Friendbot-refilled) and `/api/test-money`; data source switch sample/testnet; USD display for testnet accounts; testnet rent finding documented.
- 2026-10-25: Demo admin at /admin (passphrase): site-wide demo mode in Vercel Blob with automatic fallback to sample data, health panel (RPC, testnet rent, contracts, operator floats, relayer), recent errors, sample reset; /api/health; data source preference can follow the site default.
