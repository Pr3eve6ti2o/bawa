# Testing Strategy

Bawa uses layered testing because a wallet implementation can be internally consistent and still be wrong.

## Deterministic standards vectors

Required coverage — not all items below are implemented:

- BIP-39 mnemonic validation and mnemonic-to-seed vectors;
- BIP-32 master and child vectors, including hardened and leading-zero cases;
- BIP-84 Bitcoin native-SegWit outputs;
- BIP-44 Ethereum outputs;
- extended-key serialization and checksum behavior.

Current automated coverage comprises BTC/ETH/TRX watch-only smoke derivations at indices 0–1 on both the receiving and change branches, CLI and daemon checks (including branch rejection), an address-only differential test for BIP-84 Bitcoin and BIP-44 Ethereum at indices 0–1, BIP-44 TRON at indices 0–1, BTC change 0, TON, BIP-84 abandon anchors, Hardhat account 0 and BIP-32 test-vector-1 xpubs (T30), and a payment-record schema/arithmetic check (`test/payment_record_check.py`, stdlib-only; shipped example PASS, tampered copy rejected). It does not cover BIP-39 mnemonic validation or mnemonic-to-seed vectors, BIP-32 master/child vectors including hardened and leading-zero cases, or extended-key serialisation/checksum behaviour.

The current Trust Wallet Core generator contains public regression fixtures. **Full published-vector coverage** is **FAIL**: vectors covering TRX and indices 1–2, not only BTC/ETH index 0. (The root README used to carry this as a §18 table; the rewritten README no longer has that section, so the FAIL is recorded here instead.)

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

Implemented guards are not automated tests: `tools/hdwallet-gen/derive.js:119–128` enforces `MAX_INDEX 2147483647`, and `tools/hdwallet-gen/extended-key.js:333` rejects private extended keys (`validateAccountKey`); `tools/hdwallet-gen/derive-daemon.js:67` sets the same `MAX_INDEX`, and `:136,167–171` reject over-long lines ("request too large") and malformed JSON ("bad json").

## TON-specific coverage

TON needs explicit fixtures for:

- mnemonic scheme;
- derivation path;
- wallet contract/version;
- workchain;
- mainnet/testnet presentation;
- wallet/subwallet ID;
- bounceable/non-bounceable address forms.

The verified fixture is recorded in docs/11-trust-wallet-and-independent-verification: Wallet V4 R2, wallet ID 698983191, derivation path m/44'/607'/0', non-bounceable mainnet presentation UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn. No automated test currently asserts that fixture as a derivation (the address string appears in `apps/web/src/engine/boundary.test.ts` only as an address-validation case).

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

Entry point: the test taxonomy and the release gates for this revision live in docs/10. The executable suites are the smoke suite at test/smoke.test.js plus the register-links suite at test/register-links.test.js, run together with npm test from tools/hdwallet-gen (412 smoke checks + 28 register-links checks = 440 total), and the differential test at test/differential_test.py. Use npm run check from tools/hdwallet-gen to verify the tools' syntax and the daemon's startup probe, and .github/workflows/ci.yml for the CI steps. The supported Node range is >=22 <23.

Verification record (2026-11-09, muse-vm, Node v24.22.2 — outside the declared >=22 <23 range): on commit 754721cd, smoke suite 28/28 exit 0; check exit 0; differential test exit 0 with the BTC bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd and ETH 0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7 addresses in the provisioned environment, and exit 1 in a clean venv with ModuleNotFoundError: No module named 'bip_utils' before installing the pinned requirements. Full published-vector coverage — FAIL (see "Deterministic standards vectors" above; the README §18 link it used to carry is gone with the README rewrite). The Node-version requirement has been verified in range on Node 22.23.4 (2026-11-08, 28/28); do not mark in-range validation as completed.

Verification record (2026-11-27, loud-stone, Node v22.23.4, token-gaps `33f1ff1`, docs-currency Lane 4): root `npm test` — smoke suite 412 ok / 0 not-ok, register-links 28 PASS, exit 0; web `npm run test` — 120 files, 3,216 passed + 5 skipped, 0 failed, 92.66 s; web `npm run build` exit 0, total JS 4,473,583 bytes, largest chunk 2,906,489 bytes.

Verification record (2026-11-28, loud-stone, publish gates at token-gaps `2205f15`, P2/P3 merge + bughunt-v2-fixes — NOT a fresh run, figures as verified first-hand before pushing): web typecheck 0, eslint 0, build 0; web `npm run test` — 129 files, 3,347 passed + 5 skipped, 0 failed; total JS 4,482,619 bytes (budget 6,000,000, passing by 1,517,381); diagram-references test 5/5; live site root 200 serving `index-B2tRFRuM.js` (gh-pages `5d64609`). A fresh full verification run at `2205f15` — including the root smoke and register-links suites — is still owed; these are the pre-push publish gates, not a re-run.

Verification record (2026-11-28, loud-stone, token-gaps `734cfef`, docs-currency Lane B — hands-on, 0 Sol calls): root `npm test` re-run first-hand, exit 0 — smoke suite 412 ok / 0 not-ok, register-links 28 PASS (440 checks, 0 fail); web gates as verified first-hand by the coordinator before pushing: typecheck 0, eslint 0, build 0, vitest 129 files / 3,351 passed + 5 skipped / 0 failed, total JS 4,482,622 bytes (budget 6,000,000, passing by 1,517,378); live site root 200 serving `index-BxW-qfX0.js` (gh-pages `43fe69f`). This closes the fresh-full-run item the `2205f15` record left open.

Verification record (2026-11-28, loud-stone, token-gaps `1253bf6`, honest-remains Lane 4 — hands-on, 0 Sol calls; tip `ceade79` is docs-only past it): web gates as verified first-hand by the lane before pushing: typecheck 0, eslint clean, build exit 0, vitest 129 files / 3,429 passed + 5 skipped / 0 failed, total JS 4,509,662 bytes (budget 6,000,000, passing by 1,490,338); live site root 200 serving `index-Brm7r34g.js` (gh-pages `c0cf697`). The root smoke + register-links suites were not re-run at this tip — the 440-check figure above (at `734cfef`) is the last fresh full run of those suites.

The CI workflow is `.github/workflows/ci.yml`.
