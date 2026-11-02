# Demo script (SCF #46 video, about 4 minutes)

Recorded on https://ancora-gray.vercel.app with two browser profiles: **Ana** (founder, treasurer of a
club) and **Rui** (board member). Your pass → Network & data must say "Stellar testnet". Everything
shown is real on the testnet; say so once at the start.

## 1. An account in two minutes (0:00–0:40)

- Ana creates her pass with a passkey (no seed phrase), founds "Tejo Rowing Club", takes test
  BlendUSDC. Point at the money headline and the account's Stellar address (expert mode).
- Say: the organization is a Soroban contract; ancora never holds its money.

## 2. Rules the account enforces (0:40–1:30)

- Rules → approval tiers: up to €200 no approval, up to €2,000 one board member, above that two
  plus a 48-hour objection window. Ana adds Rui to the board.
- Ana sends €500 to a supplier: the preview shows "1 board approval". Rui approves on his device;
  the payment goes out. Open the transaction in the explorer.

## 3. Private details and an auditor (1:30–2:20)

- Settings → Private details: both set up their devices, Ana makes details private.
- Ana pays with the reference "Coach fee October"; Rui reads it. Open the organization contract
  in the explorer: the stored memo is `enc1:…` ciphertext.
- Ana adds an accountant as auditor and shares access; the accountant's Audit page shows the
  requests and the private reference, and downloads the statement as CSV.

## 4. The confidential pot (2:20–3:30)

- Confidential pot → Open the pot (the registration proof is made in the browser, a couple of
  seconds). Move €10 in.
- Pay another organization's pot €4. Say: the contract checks a zero-knowledge proof; the amount
  is never on the ledger. Show the pot's `transfer` event in the explorer: parties visible, no
  amount. On the other organization's device the €4 arrives and can be taken out.
- Say: a payment's amount is hidden from the contract too, so it takes the strictest approvals;
  approvers read it with "Show the amount".

## 5. Keys that come back (3:30–4:00)

- Your pass → Keys on this device: backup code, and "Bring back with my passkey" on a phone the
  passkey syncs to. Mention the quantum-safe ML-DSA seal for large payments (Settings → Security
  seal).
- Close: open source (Apache-2.0), six end-to-end flows run against production every night;
  the SCF plan in `docs/ROADMAP.md`.

Labels to keep on screen: "Preview" on the pot, "Simulated" wherever sample data shows.
