# Verification Lane C — Valid mainnet addresses (§6 item 4)

- **Branch:** `panel-rebuild/verify-addrs` (new worktree, off `panel-rebuild/fix-adapters`)
- **Base commit:** `fe6fd76` — "Fix Lane 2: Phase 2+3 evidence + 500s prompt re-split (final)"
  (confirmed by `git log --oneline -1` before starting work)
- **Worktree:** `/home/boxd/workspace/bawa-panel-rebuild/verify-addrs/` on muse-vm
- **Date/time of runs:** 2026-11-19, ~22:57 UTC / 04:27 IST
- **Scope:** verification only. No code was fixed, no push was made.
- **Sol calls:** 0 made, 0 landed. This lane was done entirely hands-on;
  no model call was needed.

## Environment

| Item | Value |
| --- | --- |
| Node used | `v22.23.4` via `/home/boxd/.nvm/versions/node/v22.23.4/bin/node` (repo requires `>=22 <23`; VM default is v24.22.2, not used) |
| Wallet Core | `@trustwallet/wallet-core` **4.9.3** (`apps/web/package.json` + installed `node_modules`) |
| WASM | `apps/web/public/wallet-core.wasm`, sha256 `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217`, 10,422,325 bytes — matches the pinned 4.9.3 hash |
| Dependencies | `node_modules/` + `public/` copied from the sibling `fix-adapters` worktree (same commit `fe6fd76`, same lockfile); both are git-ignored, no source files were touched |

## Method (three independent checks per address)

1. **Wallet Core `CoinTypeExt.validate`** — standalone Node script
   (`/tmp/verify-addrs-c.mjs`, deleted after the run) calling `initWasm()` from
   the repo's installed 4.9.3 package, `CoinTypeExt.validate(coin, address)`
   for each listed address, plus negative controls.
2. **Independent format checks in the same script** (no wallet-core code):
   Bech32 polymod verification (BTC), EIP-55 checksum via `viem` `getAddress`
   (ETH), Base58Check decode + double-SHA-256 checksum + version byte (TRX),
   TON friendly-address decode + CRC16-XMODEM + tag/workchain bytes (TON).
3. **The repo's own validators** — temporary vitest probe
   (`src/wallet/verify-addrs-temp.test.ts`, 4 tests, deleted after the run)
   calling `validateDestination` (`src/engine/destination.ts`) and
   `validateTonAddress` (`src/engine/boundary.ts`), plus the existing suites
   (see "Vitest results" below).

## Results — listed addresses (all PASS)

| Chain | Address | `CoinTypeExt.validate` | Independent format check | Repo `validateDestination` |
| --- | --- | --- | --- | --- |
| BTC index 0 | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | `true` (bitcoin) | Bech32 checksum OK, HRP `bc`, data 39 chars — **mainnet**, not testnet | `ok: true, p2wpkh, verified` |
| ETH index 0 | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | `true` (ethereum) | `viem getAddress` returns the identical string — **EIP-55 checksum correct** | `ok: true, eoa, verified` |
| ETH (2nd vector) | `0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` | `true` (ethereum) | `viem getAddress` returns the identical string — **EIP-55 checksum correct** | `ok: true, eoa, verified` |
| TRX index 0 | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | `true` (tron) | Base58Check OK, version byte `0x41` (65), payload `59b2f14f54513afa5b324aabd5c70362e7aa0836` | `ok: true, base58check, verified` |
| TRX index 1 | `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` | `true` (tron) | Base58Check OK, version byte `0x41` (65), payload `e59e20e6d2e1a3578498594574b0e9aa792261f2` | `ok: true, base58check, verified` |
| TON | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` | `true` (ton) | Tag `0x51`, workchain `0`, CRC16 OK, testnet flag **clear** — **mainnet**; hash `bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f` | `ok: true, non-bounceable, verified`; `validateTonAddress` → `ok: true, form: non-bounceable, workchain: 0` |

Raw validator output (standalone script): `SUMMARY listedAllWalletCoreValid=true
freshAllWalletCoreValid=true`. Every listed address validated `true` under
wallet-core 4.9.3 and passed its independent format check and the repo
validator.

## Results — fresh disposable mnemonic

- Generated once in memory with `crypto.getRandomValues` (32 bytes entropy)
  via `HDWallet.createWithEntropy`, the same path as the repo's `createWallet`.
- **Word count: 24. `Mnemonic.isValid` = true.**
- The mnemonic itself was **never printed, logged, committed or uploaded**;
  entropy was wiped (`fill(0)`) and the WASM wallet deleted after use.
  Only the public derived addresses are recorded here.
- Derived (account/index zero, repo default paths) and validated:

| Chain | Derived public address | `CoinTypeExt.validate` | Format check |
| --- | --- | --- | --- |
| BTC | `bc1qha27sdanjws7tjt0eu099pya4zt3mhjtgyppxw` | `true` | Bech32 OK, HRP `bc` |
| ETH | `0x7637492856b8bFE2848C90C04d14B6800A697E0d` | `true` | `viem getAddress` identical — EIP-55 correct |
| TRX | `TUSTJe4ka2LTyDGkCRjg2B6un2HsptjSLG` | `true` | Base58Check OK, version `0x41`, payload `ca996f49b16c4417a03e0630abba3b9c8f98cb32` |
| TON | `UQDeIhJnChxHLEfTl7RgeWBiZ-qwZaVqbbTYW67V1oDmRB7D` | `true` (also `true` for the raw wallet-core form before UQ normalisation) | Tag `0x51`, workchain `0`, CRC16 OK, testnet flag clear; hash `de2212670a1c472c47d397b46079606267eab065a56a6db4d85baed5d680e644` |

The repo's own path gives the same guarantee: `core.test.ts` (passing, see
below) creates a fresh 24-word mnemonic, derives all four chains, restores
with identical addresses, and asserts the `bc1q` / `0x` / `T` / `UQ`
prefixes; it also derives the published TREZOR-vector ETH address
`0x27Ef5cDBe01777D62438AfFeb695e33fC2335979` and the BTC/ETH/TRX xpub
fixtures (`bc1qpsp72…`, `0xA3Dcd899…`, `TJ9VWHM…`, `TWuKAx5i…`).

## Negative controls (validators are not vacuous)

| Control | `CoinTypeExt.validate` | Repo validator / format check |
| --- | --- | --- |
| BTC last char mutated (`…ghpc`) | `false` | — |
| BTC `tb1q` HRP swap, same payload (`tb1qpsp72…`) | `false` (Bech32 checksum fails under HRP `tb`) | `validateDestination` → `wrong-network` |
| ETH last char mutated (`…A8`) | **`true`** — see note 2 | `validateDestination` → `invalid-checksum`; `viem getAddress(mutated)` differs from the mutated string |
| ETH all-lowercase form | `true` | `getAddress` returns the checksummed listed address |
| TRX last char mutated (`…B9d`) | `false` | `validateDestination` → `invalid-checksum` |
| TON last char mutated (`…D3zm`) | `false` (CRC fails) | `validateDestination` → `invalid-checksum` |
| TON testnet-flagged, same hash, CRC recomputed (`0QC7gZvG…D8dt`, tag `0xD1`) | **`true`** — see note 2 | `validateTonAddress` → `wrong-network`; `validateDestination` rejects the testnet flag as `wrong-network` |

## Notes and corrections (not failures)

1. **Brief wording correction — TON "bounceable":** the task brief describes
   the TON address as "UQ prefix, bounceable". That is incorrect: `UQ`
   (tag `0x51`) is the **non-bounceable** form; `EQ` (tag `0x11`) is
   bounceable. Confirmed by `src/wallet/core.ts` ("UQ uses the
   non-bounceable tag; EQ is bounceable"), `src/engine/boundary.ts`
   `validateTonAddress` (`0x51` → `form: 'non-bounceable'`), and
   `src/engine/destination.test.ts` (expects `'non-bounceable'` for this
   exact address). The listed TON address **is** a valid mainnet,
   workchain-0, non-bounceable UQ address. The verdict stands; only the
   brief's adjective was wrong.
2. **Wallet-core `validate` alone does not prove checksum or network for
   ETH/TON.** A one-character-mutated ETH address still passes
   `CoinTypeExt.validate` (format-only, no EIP-55 enforcement), and a
   testnet-flagged TON address also passes it (no `0x80` flag check).
   The checksum/mainnet proof for those two chains therefore rests on the
   additional checks, which all pass: `viem getAddress` equality (EIP-55)
   and the repo's `validateDestination` (`checksum: 'verified'`, testnet
   → `wrong-network`). Recorded as a validator limitation, not a defect
   in the addresses.
3. **Address strings alone cannot prove the network for TRX/ETH.** The repo
   states this in `destination.ts`: TRON test networks share the `0x41`
   prefix and an ETH address is identical on every EVM chain, so the
   network comes from the configured endpoint / chainId (1), never the
   address. BTC is the exception: HRP `bc` vs `tb1q` does distinguish
   mainnet, and the `tb1q` control was rejected. TON mainnet-ness is
   carried by the tag byte (`0x51`, testnet flag clear) plus workchain 0.

## Vitest results

Command (Node v22.23.4, from `apps/web`):

```sh
export PATH=/home/boxd/.nvm/versions/node/v22.23.4/bin:$PATH
npx vitest run src/wallet
npx vitest run src/engine/destination.test.ts src/engine/boundary.test.ts src/engine/boundary-retry.test.ts
```

- **`src/wallet`: 12 files, 105 tests — all passed** (existing suite).
  With the temporary 4-test probe included the run showed 13 files /
  109 tests, all passed; the probe file was deleted afterwards, so the
  committed tree contains no probe.
- **`src/engine` (destination + boundary + boundary-retry): 3 files,
  68 tests — all passed** (destination 18, boundary 49, boundary-retry 1).
- No failures, no skips. (Stderr notes only: the known WASM "Aborted…
  exception catching is not enabled" lines from the TRX/BTC 33-vs-65-byte
  abort tests, which pass by design, and React `act` deprecation warnings.)

## Verdicts

- **BTC: PASS** — `bc1q…` validates as a mainnet bech32 (P2WPKH) address; testnet `tb1q` form rejected.
- **ETH: PASS** — both addresses validate and are exactly EIP-55 checksummed (repo validator: `verified`).
- **TRX: PASS** — both addresses validate as base58check with mainnet version `0x41`; one-char mutation rejected.
- **TON: PASS** — `UQ…` validates as a mainnet, workchain-0, non-bounceable UQ address (tag `0x51`, CRC valid, testnet flag clear); testnet-flagged form rejected by the repo validator.

## Safety

- Disposable generated test credentials only: the fresh mnemonic was
  generated once in memory for this verification, never funded, never used
  for anything else, never printed/logged/committed/uploaded; entropy wiped
  and the wallet object deleted. No private key was printed, logged,
  committed or uploaded. No transfer, send or broadcast of any
  cryptocurrency. Read-only and offline validation only.
- The standalone script and the temporary vitest probe were deleted from
  the VM after their runs. The only file added by this lane is this report.
