# Bawa Reference Implementation

Bawa contains a small, security-conscious reference implementation for one-time wallet creation and watch-only public derivation. It is deliberately narrower than a commercial wallet product.

## Runtime boundary

```
Interactive generation (implemented here):
  Trust Wallet Core → BTC/ETH/TRON account public roots; TON address + `ton_path`.

Online application
  Public derivation (implemented by `derive.js` / `derive_daemon.js`):
    BTC/ETH/TRON public roots → addresses.
      ↓
  External application responsibilities, not implemented by these tools:
    RPC / node / indexer access → tracking / payment reconciliation.
```

The generator does not need an online chain connection to create wallet material. `derive.js` and `derive_daemon.js` contain private-extended-key rejection guards; `compare.js` does not enforce a public-only input boundary.

The generator requires a controlling terminal. If it cannot open `/dev/tty` for writing, it reports FATAL and exits with status 1. Network-independent generation does not imply unattended operation.

## Current implementation

- `tools/make_wallet.py` — orchestration, environment/bootstrap checks and backup handling.
- `tools/hdwallet-gen/generate.js` — Trust Wallet Core generation and public-root export.
- `tools/hdwallet-gen/derive.js` — one-shot public derivation.
- `tools/hdwallet-gen/derive_daemon.js` — JSON-line daemon for repeated public derivation.
- `tools/hdwallet-gen/compare.js` — comparison helper intended for public inputs; it must not be relied on to reject private extended keys.
- `tools/decrypt_seed.py` — controlled recovery of the encrypted seed artifact.

### Daemon protocol

`tools/hdwallet-gen/derive_daemon.js` accepts one JSON object per line:
`{"chain":"btc|eth|trx","xpub":"...","index":5}`.
Only `btc`, `eth` and `trx` are supported for `chain`; TON public derivation
is not provided by the daemon.

On launch, the daemon prints the startup line `{"ready":true}`.
Success responses are `{"ok":true,"address":"..."}`.
Failure responses are `{"ok":false,"error":"..."}`.

The line-length limit is 4096 (`MAX_LINE_LENGTH`), the xpub-length limit
is 200 (`MAX_XPUB_LENGTH`) and the maximum index is 2147483647 (`MAX_INDEX`).
Blank lines are ignored. On `SIGTERM`, the daemon exits cleanly with code 0.

`test/smoke.test.js` §6 exercises the startup line, a BTC derivation
and an unknown-chain rejection.

## Current reference policy

- Bitcoin BIP-84 account: `m/84'/0'/0'` → `zpub`.
- Ethereum BIP-44 account: `m/44'/60'/0'` → `xpub`.
- TRON BIP-44 account: `m/44'/195'/0'` → `xpub`.

`derive.js` and `derive_daemon.js` use the external `/0/i` branch: BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i` and TRON `m/44'/195'/0'/0/i`.
- TON: exports the address obtained through `w.getAddressForCoin(CoinType.ton)` and the stdout JSON field `ton_path`, whose value is `m/44'/607'/0'` (from `CoinTypeExt.derivationPath(CoinType.ton)`). Neither `derive.js` nor `derive_daemon.js` provides TON public derivation.

TON is intentionally treated as chain-specific because wallet contract/version and wallet-ID/subwallet semantics matter.

The exported TON address uses contract Wallet V4 R2 with wallet ID / subwallet `698983191` (0x29A9A317). The wallet ID is load-bearing: V4R2 with wallet ID 0 derives a different address. See `docs/11` for the verified fixture.

## Verification layers

1. Trust Wallet Core deterministic self-checks.
2. Official BIP/CIP/TEP vector coverage has not been established; identify applicable fixtures, their provenance and the checks performed before claiming this layer.
3. Independent `bip_utils` comparisons cover BTC and ETH at index 0 only; TRON and TON are not covered.
4. `test/smoke.test.js` includes `derive.js` rejection tests for a bad chain, a negative index and an empty xpub; no repository test feeds a private extended key to any tool.
5. Integration and reconciliation testing is an external application responsibility; no such test file is present in this repository.

See [Testing](docs/TESTING.md).

## Dependency rule

`@trustwallet/wallet-core` is the wallet-crypto engine. `bip-utils` is a pinned reference-test dependency only. `@hdwallet/core` is not used by the runtime.

The wallet package pins `@trustwallet/wallet-core` to `4.9.3` and declares Node `>=22 <23`. Python requirements pin `cryptography==50.0.2` and `bip-utils==2.12.3`.

## Production status

This is reference/security-conscious code, not a security audit and not a hosted custody solution. Before real-money deployment, verify a clean installation in `tools/hdwallet-gen` using its committed `package-lock.json` and a Node version in the declared range `>=22 <23`, full independent differential coverage, chain-specific fixtures, secret/dependency scanning, reproducible release checksums/provenance and an external security review.
