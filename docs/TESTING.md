# Testing Strategy

Bawa uses layered testing because a wallet implementation can be internally consistent and still be wrong.

## Deterministic standards vectors

Required coverage — not all items below are implemented:

- BIP-39 mnemonic validation and mnemonic-to-seed vectors;
- BIP-32 master and child vectors, including hardened and leading-zero cases;
- BIP-84 Bitcoin native-SegWit outputs;
- BIP-44 Ethereum outputs;
- extended-key serialization and checksum behavior.

Current automated coverage comprises BTC/ETH/TRX watch-only smoke derivations at indices 0–1 on both the receiving and change branches, CLI and daemon checks (including branch rejection), an address-only differential test for BIP-84 Bitcoin and BIP-44 Ethereum at index 0, and a payment-record schema/arithmetic check (`test/payment_record_check.py`, stdlib-only; shipped example PASS, tampered copy rejected). It does not cover BIP-39 mnemonic validation or mnemonic-to-seed vectors, BIP-32 master/child vectors including hardened and leading-zero cases, or extended-key serialisation/checksum behaviour.

The current Trust Wallet Core generator contains public regression fixtures. The root README, section 18, lists **Full published-vector coverage** as **FAIL**: vectors covering TRX and indices 1–2, not only BTC/ETH index 0.

## Independent differential verification

Bawa uses bip_utils only as an independent reference implementation for overlapping standards and paths.

~~~
official vector
      ↓
Trust Wallet Core ──────┐
                        ├── compare public outputs
bip_utils ──────────────┘
~~~

The pinned bip-utils==2.12.2 dependency is not imported by runtime wallet-generation code.

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
- oversized JSON lines — **no automated coverage**;
- invalid chain names — **partial — daemon only**;
- negative indexes — **covered**;
- indexes at or above 2^31 — **no automated coverage**;
- malformed Base58/checksums — **no automated coverage**;
- private extended keys supplied where public keys are required — **no automated coverage**;

Known exception: tools/hdwallet-gen/compare.js has no private-extended-key check; a 2026-11-09 probe feeding an xprv to it printed the same BTC address three times (exit 0). No regression test covers this.

- corrupted AES-GCM ciphertext — **no automated coverage**;
- wrong data keys — **no automated coverage**;
- truncated recovery artifacts — **no automated coverage**;
- symlinked secret paths — **no automated coverage**;
- unexpected existing outputs — **no automated coverage**;
- missing .env — **no automated coverage**.

Implemented guards are not automated tests: `tools/hdwallet-gen/derive.js:83–92` enforces `MAX_INDEX 2147483647` and rejects private extended keys; `tools/hdwallet-gen/derive_daemon.js:76–85` rejects over-long lines ("request too large") and malformed JSON ("bad json").

## TON-specific coverage

TON needs explicit fixtures for:

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
known funding event
      ↓
chain observation
      ↓
payment match
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

Entry point: the test taxonomy and the release gates for this revision live in docs/10. The executable suites are the smoke suite at test/smoke.test.js, run with npm test from tools/hdwallet-gen (28 tests), and the differential test at test/differential_test.py. Use npm run check from tools/hdwallet-gen to verify the tools' syntax and the daemon's startup probe, and .github/workflows/ci.yml for the CI steps. The supported Node range is >=22 <23.

Verification record (2026-11-09, muse-vm, Node v24.22.2 — outside the declared >=22 <23 range): on commit 754721cd, smoke suite 28/28 exit 0; check exit 0; differential test exit 0 with the BTC bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd and ETH 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7 addresses in the provisioned environment, and exit 1 in a clean venv with ModuleNotFoundError: No module named 'bip_utils' before installing the pinned requirements. Full published-vector coverage — FAIL, linked to README section 18, line 1128. The Node-version requirement has been verified in range on Node 22.23.4 (2026-11-08, 28/28); do not mark in-range validation as completed.

The CI workflow is `.github/workflows/ci.yml`.
