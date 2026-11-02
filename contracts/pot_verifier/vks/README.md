# Verification keys

The UltraHonk verification keys of OpenZeppelin's confidential-token circuits, copied unchanged
from [OpenZeppelin/stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) v0.8.0
(`packages/confidential/circuits/vks/*.vk.bin`, Apache-2.0). They were produced with nargo
1.0.0-beta.11 and bb 0.87.0 (Keccak transcript, non-zk), as pinned upstream.

ancora proves in the browser with `@noir-lang/noir_js` 1.0.0-beta.11 and `@aztec/bb.js` 0.87.0;
compiling the circuits with `@noir-lang/noir_wasm` 1.0.0-beta.11 and deriving the keys with
bb.js gives byte-identical files for `register`, `withdraw` and `transfer` (checked 2 Nov 2026).
