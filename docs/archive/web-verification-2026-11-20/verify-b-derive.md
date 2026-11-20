# Verification Lane B — Wallet creation + recovery + derivation vs fixtures

- **Branch:** `panel-rebuild/verify-derive` (worktree `/home/boxd/workspace/bawa-panel-rebuild/verify-derive/`, on muse-vm)
- **Base commit:** `fe6fd76` — Fix Lane 2 (`panel-rebuild/fix-adapters`), confirmed by `git log --oneline -1` before starting
- **Date:** 2026-11-19 ~04:28 IST (2026-11-18 22:58 UTC)
- **Scope:** §6 items 1, 2, 3 of the Bawa wallet-panel rebuild (owner orders 2026-11-18 ~18:22/~18:35 IST, 2026-11-19 ~04:20 IST)
- **Method:** hands-on only — **zero Sol calls** (no model call was needed; every check ran first-hand)

## Environment

- Node: **v22.23.4** via nvm (repo enforces >=22 <23; VM default is v24.22.2 — not used)
- Deps installed fresh in this worktree with Node 22: `apps/web` (`npm ci`, 275 packages) and `tools/hdwallet-gen` (`npm ci`, 14 packages)
- Engine: `@trustwallet/wallet-core` **4.9.3** in both installs

## WASM hash check — PASS

Expected 4.9.3 sha256: `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`

| Copy | sha256 | Match |
| --- | --- | --- |
| `apps/web/node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.wasm` | `13a18a38…77217` | YES |
| `tools/hdwallet-gen/node_modules/@trustwallet/wallet-core/dist/lib/wallet-core.wasm` | `13a18a38…77217` | YES |

Both installed copies hash to the pinned 4.9.3 value.

## How the runs were done

Two independent paths exercised the same 4.9.3 engine:

1. **Raw-WASM Node script** (`/tmp/verify-derive-b.js` on the VM, kept out of the repo so no secret can ever land in the tree): uses `tools/hdwallet-gen`'s wallet-core directly — fresh CSPRNG creation, recovery, fixture derivation, xpub derivation, and the TRX 33-byte probe. Prints public addresses and PASS/FAIL only; the fresh disposable mnemonic lives in memory only and is never printed, logged, or committed. Exit code 0, `OVERALL ALL CHECKS PASSED`.
2. **Web-layer vitest** for `apps/web/src/wallet/core.ts` + `chains.ts` (see below).

## Item 1 — Wallet creation — PASS

Fresh disposable 24-word BIP-39 mnemonic generated from 256 bits of `crypto.randomBytes` via `HDWallet.createWithEntropy(entropy, "")` (empty passphrase, per Bawa policy). Word count **24**, `Mnemonic.isValid` true. Derived mainnet addresses (public only):

| Chain | Path | Address |
| --- | --- | --- |
| BTC | m/84'/0'/0'/0/0 | `bc1q3kaegfvl66t4v92pn0naxu5mrxt6ategdj8phl` |
| ETH | m/44'/60'/0'/0/0 | `0x6b15599B8849D046df7f566522a27eEFdBF2f7De` |
| TRX | m/44'/195'/0'/0/0 | `TMPw7BSyK2Rtbc1HbFv9GbTKdDj55jdySW` |
| TON | m/44'/607'/0' | `UQACGsZERPoiOILkDMyfTv1GK7Q5OeHuNc2Pe0uYTlmz57XL` |
| TRX idx 1 | m/44'/195'/0'/0/1 (via fresh xpub) | `TVBATvtQfpWM4o9ykQZNQ51m7wwnohFMh5` |

All four index-0 addresses pass `CoinTypeExt.validate`; BTC is `bc1q…`, ETH `0x…`, TRX `T…`, TON is `UQ…` length 48. TRX index 1 is valid and differs from index 0.

## Item 2 — Recovery with identical addresses — PASS

Recovered from the SAME disposable mnemonic with a fresh `HDWallet.createWithMnemonic(mnemonic, "")` object (the import/restore flow). Mnemonic round-trips identically. Second derivation:

| Chain | Recovery address | Identical to creation? |
| --- | --- | --- |
| BTC | `bc1q3kaegfvl66t4v92pn0naxu5mrxt6ategdj8phl` | YES |
| ETH | `0x6b15599B8849D046df7f566522a27eEFdBF2f7De` | YES |
| TRX | `TMPw7BSyK2Rtbc1HbFv9GbTKdDj55jdySW` | YES |
| TON | `UQACGsZERPoiOILkDMyfTv1GK7Q5OeHuNc2Pe0uYTlmz57XL` | YES |
| TRX idx 1 | `TVBATvtQfpWM4o9ykQZNQ51m7wwnohFMh5` | YES |

All five values byte-identical between the creation run and the recovery run.

## Item 3 — Correct derivation vs published fixtures — PASS

Fixture mnemonic is the published TREZOR BIP-39 vector already committed in the repo (`tools/hdwallet-gen/generate.js` `VEC_MNEMONIC`, 15 words), empty passphrase unless stated. All values derived first-hand in this lane:

| Check | Expected | Actual | Match |
| --- | --- | --- | --- |
| BTC idx 0, m/84'/0'/0'/0/0 | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | same | YES |
| ETH idx 0, m/44'/60'/0'/0/0 | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | same | YES |
| ETH, passphrase `TREZOR` | `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` | same | YES |
| TRX idx 0, m/44'/195'/0'/0/0 | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | same | YES |
| TRX idx 1, m/44'/195'/0'/0/1 (via xpub) | `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` | same | YES |
| TON, m/44'/607'/0' (V4 R2, wallet ID 698983191) | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` | same | YES |
| BTC idx 0 via repo zpub fixture | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | same | YES |
| ETH idx 0 via repo xpub fixture | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | same | YES |
| TRX idx 0 via repo xpub fixture | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | same | YES |

Cross-tie: the TRX/ETH/BTC xpubs derived from the fixture mnemonic (`getExtendedPublicKeyAccount`) are exactly the xpub/zpub fixtures in `apps/web/src/wallet/core.test.ts` — so the xpub fixtures and the address fixtures trace to the same published mnemonic. No mismatches anywhere.

### Known TRX 33-byte trap — reproduced as documented (not worked around)

- 33-byte compressed TRX pubkey from `getPublicKeySecp256k1(true)`: `deriveAddressFromPublicKey` **throws** — the WASM runtime aborts (`Aborted(Assertion failed: Exception thrown, but exception catching is not enabled…)` on stderr, caught in JS). Still present on 4.9.3, exactly as documented in `core.ts` / `core.test.ts`.
- 65-byte uncompressed form derives fine and equals `getAddressForCoin` (`TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`).

## Vitest — `core.test.ts` + `chains.test.ts` — PASS

Command (Node v22.23.4, in `apps/web`):

```text
npx vitest run src/wallet/core.test.ts src/wallet/chains.test.ts
```

Result: **2 test files passed, 27 tests passed, 0 failed** (core.test.ts 10 tests, chains.test.ts 17 tests), exit 0, duration ~0.5 s. The two `Aborted(…)` stderr lines in the output are the expected TRX-33-byte / BTC-65-byte abort probes inside the tests themselves — both assertions pass. `chains.test.ts` asserts the exact pinned paths (`m/84'/0'/0'/0/0`, `m/44'/60'/0'/0/0`, `m/44'/195'/0'/0/0`, `m/44'/607'/0'`).

## Verdicts

- **Item 1 — Wallet creation: PASS.** Fresh 24-word CSPRNG mnemonic; all four mainnet addresses derived and valid.
- **Item 2 — Recovery with identical addresses: PASS.** All five derived values (4× index 0 + TRX index 1) byte-identical after restore from the same mnemonic.
- **Item 3 — Derivation vs published fixtures: PASS.** All six expected addresses match (plus three xpub-derived cross-checks and the xpub-fixture tie to the same mnemonic); TRX 33-byte abort reproduced as documented.

## Safety notes

- The fresh mnemonic generated for items 1–2 was disposable: used once in memory, never funded, never printed/logged/committed/uploaded; no private key or mnemonic appears in this file, in any log, or in any commit. Only public addresses are recorded above.
- No transfer, send, or broadcast of any cryptocurrency took place; derivation only, offline.
- No code was changed by this lane. The only file added is this report. `node_modules/` is git-ignored; the worktree was clean apart from this file at commit time.
- Nothing was pushed. Local commit only.
