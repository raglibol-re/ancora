# Confidential pot test vectors

- `primitives/*.json`: OpenZeppelin's cross-language vectors for the confidential token's
  cryptography, copied unchanged from
  [OpenZeppelin/stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) v0.8.0
  (`packages/confidential/circuits/lib/testdata`, Apache-2.0). The app's client
  (`app/src/adapters/testnet/pot`) must reproduce every output.
- `register.proof`, `register.inputs.bin`: a register proof made with ancora's browser toolchain
  (noir_js 1.0.0-beta.11, bb.js 0.87.0, Keccak transcript) for the pot at
  `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` and the account
  `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF`, with its six public inputs (32 bytes
  each). The contract tests verify it with the real verifier.
