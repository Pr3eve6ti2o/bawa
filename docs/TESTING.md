# Testing Strategy

Bawa uses layered testing because a wallet implementation can be internally consistent and still be wrong.

## Deterministic standards vectors

Required coverage — not all items below are implemented:

- BIP-39 mnemonic validation and mnemonic-to-seed vectors;
- BIP-32 master and child vectors, including hardened and leading-zero cases;
- BIP-84 Bitcoin native-SegWit outputs;
- BIP-44 Ethereum outputs;
- extended-key serialization and checksum behavior.

Current automated coverage comprises BTC/ETH/TRX watch-only smoke derivations at indices 0–1, CLI and daemon checks, and an address-only differential test for BIP-84 Bitcoin and BIP-44 Ethereum at index 0. It does not cover BIP-39 mnemonic validation or mnemonic-to-seed vectors, or BIP-32 master/child vectors including hardened and leading-zero cases. No extended-key serialisation round-trip test was found, while checksum-rejection behaviour is tested.

The current Trust Wallet Core generator contains public regression fixtures. The row at `docs/README-FULL.md:1248` lists **Full published-vector coverage** as **FAIL**: vectors covering TRX and indices 1–2, not only BTC/ETH index 0.

## Independent differential verification

Bawa uses bip_utils only as an independent reference implementation for overlapping standards and paths.

~~~
official vector
      ↓
Trust Wallet Core ──────┐
                        ├── compare public outputs
bip_utils ──────────────┘
~~~

The pinned bip-utils==2.12.3 dependency is not imported by runtime wallet-generation code.

Run from the repository root:

~~~
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 test/differential_test.py
~~~

Never put a real mnemonic, seed, xprv, hardware-wallet secret or production backup in tests.

## Negative/security tests

Required automated negative/security coverage — this is not a list of passing tests.

- malformed JSON — **no automated coverage**;
- oversized JSON lines — **covered**;
- invalid chain names — **covered**;
- negative indexes — **covered**;
- indexes at or above 2^31 — **no automated coverage**;
- malformed Base58/checksums — **covered**;
- private extended keys supplied where public keys are required — **covered**;

Current safeguard: tools/hdwallet-gen/compare.js rejects private extended keys pre-WASM via validateExtendedKey; smoke.test.js section 8 covers this. The 2026-11-09 xprv probe (exit 0) is historical only and does not reproduce (live probe exits 1).

- corrupted AES-GCM ciphertext — **covered** (smoke.test.js section 10: "verifySeedBundle: tampered ciphertext rejected" at :1166);
- wrong data keys — **covered** (smoke.test.js section 10: "verifySeedBundle: wrong key rejected" at :1169);
- truncated recovery artifacts — **covered** (malformed-bundle rejection check);
- symlinked secret paths — **no automated coverage**;
- unexpected existing outputs — **no automated coverage**;
- missing .env — **no automated coverage**.

Implemented guards are not automated tests: `tools/hdwallet-gen/derive.js:52–57` enforces `MAX_INDEX 2147483647` and rejects private extended keys; `tools/hdwallet-gen/derive_daemon.js:71,87–91` rejects over-long lines ("request too large") and malformed JSON ("bad json").

## TON-specific coverage

The following TON fixture needs have been identified; this list is not asserted to be complete. In the recorded fixture, workchain is inferred from the address’s `0:` prefix rather than stated as an explicit fixture field. TON needs explicit fixtures for:

- mnemonic scheme;
- derivation path;
- wallet contract/version;
- workchain;
- mainnet/testnet presentation;
- wallet/subwallet ID;
- bounceable/non-bounceable address forms.

The verified fixture is recorded in docs/11: Wallet V4 R2, wallet ID 698983191, derivation path m/44'/607'/0', non-bounceable mainnet presentation UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn. No automated test currently asserts that fixture.

A syntactically valid TON address is not enough evidence of derivation correctness.

## Application integration tests

Planned application integration tests: no payment-tracking implementation, integration test harness or runnable integration-test command exists at this revision. Run it as an external manual procedure only when a tracking implementation exists.

Payment tracking must be tested separately from wallet derivation:

~~~
address allocation
      ↓
observed blockchain event
      ↓
chain observation
      ↓
payment match (totaling matching payments + unique event/payment identification)
      ↓
confirmation/finality
      ↓
atomic claim
      ↓
fulfillment
      ↓
reconciliation
~~~

Exercise duplicate observations, provider failures, restarts, reorgs and late payments.

Entry point: the release gates for this revision live in docs/10. The executable suites are the smoke suite at test/smoke.test.js, run with npm test from tools/hdwallet-gen (130 runtime checks at a5bc56e, including the daemon's startup probe), and the differential test at test/differential_test.py. Use npm run check from tools/hdwallet-gen to verify the tools' syntax only, and .github/workflows/ci.yml for the CI steps. The supported Node range is >=22 <23.

Verification record (2026-11-09, muse-vm, Node v24.22.2 — outside the declared >=22 <23 range): on commit 754721cd, smoke suite 28/28 exit 0; check exit 0; differential test exit 0 with the BTC bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd and ETH 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7 addresses in the provisioned environment, and exit 1 in a clean venv with ModuleNotFoundError: No module named 'bip_utils' before installing the pinned requirements. Full published-vector coverage — FAIL, linked to [docs/README-FULL.md section 18 Gates, line 1237](README-FULL.md#L1237). The Node-version requirement has been verified in range on Node 22.23.4 (2026-11-08, 28/28); do not mark in-range validation as completed.

The CI workflow is `.github/workflows/ci.yml`.
