# Verification Lane E — offline transaction construction + signing + verification

- **Scope:** §6 item 6 of the Bawa wallet-panel rebuild (owner order 2026-11-18 ~18:22 IST, mandatory correction ~18:35 IST, parallel-lanes order 2026-11-19 ~04:20 IST).
- **Branch:** `panel-rebuild/verify-sign` (new worktree `/home/boxd/workspace/bawa-panel-rebuild/verify-sign`, off `panel-rebuild/fix-adapters` at `fe6fd76` — Fix Lane 2, verified with `git log --oneline -1` before starting).
- **Date:** 2026-11-19 (IST). **Node:** v22.23.4 via nvm (the repo enforces Node >=22 <23; the VM default v24.22.2 was not used).
- **Runner:** `tools/verify-sign/run-verify-sign.mjs` (committed with this report; re-runnable, offline-only, no broadcast path).
- **Sol calls:** 0. This lane is hands-on verification throughout; no model call was needed.

## Verdicts

| Chain | Verdict | One line |
|---|---|---|
| BTC | **PASS** | Signed offline (AnySigner), BIP-143 verifies, decoded destination / amount / fee / change match, preflight 11/11. |
| ETH | **PASS** | Signed offline (AnySigner), ecrecover sender matches signer, decoded chain / to / amount / fees match, preflight 11/11. |
| TRX | **PASS** | Signed offline (AnySigner), secp256k1 recovery matches owner, decoded owner / to / amount / timestamps match, txID recomputes as SHA-256 of signed raw_data, preflight 11/11. |
| TON | **PASS** | Signed offline (AnySigner), Ed25519 verifies, sender / destination / amount / seqno / validUntil checked by `verifyTon`, normalised signing hash matches the unsigned signing hash, preflight 11/11. |

## Boundary — what was and was not verified

- `apps/web` has **no signing path**: `apps/web/src/wallet/chains.ts` marks `local-sign` and `post-sign-verify` as `blocked` for **all four chains** ("No transaction construction in this lane for local-sign (Phase 4)"), and there is **no `AnySigner` reference anywhere in `apps/web/src/`**. The only signing-adjacent code in the app is `withSigningKey` in `apps/web/src/wallet/core.ts`, which hands private-key bytes to a callback — it constructs no transaction and signs nothing. So **no chain is verified as signing inside the app**; that remains Phase 4 / Fix Lane 3 work.
- What **is** verified here: offline construction + signing + independent verification through the repo's own offline tooling — `tools/mainnet-tx/unsigned-tx.mjs` (T33 unsigned-transaction builder) and `tools/mainnet-signing/local-signing.mjs` (T35 local signer, Wallet Core 4.9.3 `AnySigner`, independent verification with own secp256k1/keccak256 code and Node Ed25519 + own BOC parsing for TON). Fix Lane 3 (send + layout page, running in parallel on its own branch) was not touched.
- **No broadcast anywhere:** the run asserts `assertNoNetworkCapability()` (`true`), the signing module has no network import / fetch / broadcast function (its own T10 test asserts this), preflight check 11 (`NO-BROADCAST`) passes for every chain, and no signed transaction was submitted to any network. **STOP BEFORE BROADCASTING: M-35 execution is NOT authorised.**

## Environment + WASM identity

- Wallet Core package version: **4.9.3** (`tools/hdwallet-gen/node_modules/@trustwallet/wallet-core/package.json`).
- WASM: `dist/lib/wallet-core.wasm`, **10,422,325 bytes**, sha256 `13a18a380202879c6877bccd38621e1af58f65b923dbe4d438dbffdd32c77217` — **MATCHES** the pinned hash. The same hash was confirmed on the `fix-adapters` worktree copy.
- Dependencies installed in this worktree with `npm ci --no-audit --no-fund` in `tools/hdwallet-gen` (14 packages, 1 s; `package-lock.json` pin).

## Commands run (all on muse-vm, Node v22.23.4)

```sh
git worktree add /home/boxd/workspace/bawa-panel-rebuild/verify-sign -b panel-rebuild/verify-sign fe6fd76
cd /home/boxd/workspace/bawa-panel-rebuild/verify-sign/tools/hdwallet-gen && npm ci --no-audit --no-fund
cd /home/boxd/workspace/bawa-panel-rebuild/verify-sign && node --test tests/mainnet-signing.test.mjs
cd /home/boxd/workspace/bawa-panel-rebuild/verify-sign && node tools/verify-sign/run-verify-sign.mjs
node /tmp/trx-trap-probe.mjs   # separate process, see "TRX trap" below
```

Baseline first: the repo's own suite `tests/mainnet-signing.test.mjs` passes **19/19, 0 fail** in ~1.5 s (T1–T4 happy paths for all four chains plus T5–T14 negatives). The Lane E run below is independent of those fixtures: fresh keys, different amounts/fees/nonce/seqno/refBlockId, and its own decoded-field checks.

## Method (runner `tools/verify-sign/run-verify-sign.mjs`)

1. Fresh **24-word mnemonic from 32 bytes of CSPRNG** (`crypto.getRandomValues` → `HDWallet.createWithEntropy`), held in process memory only. Per-chain keys derived at the `chains.ts` paths (BTC `m/84'/0'/0'/0/0`, ETH `m/44'/60'/0'/0/0`, TRX `m/44'/195'/0'/0/0`, TON `m/44'/607'/0'`; BTC change at `m/84'/0'/0'/1/0`). The mnemonic and every private-key byte array are **never printed, logged, committed or uploaded**; key byte arrays are zeroed (`fill(0)`) after use and the process exits. Only public addresses and verification outputs appear below.
2. Sender addresses derived twice and cross-checked: the signing module's own helpers (own secp256k1 + hash160/keccak256/Base58Check) **and** wallet-core `getAddressForCoin` — they agree on all four chains.
3. Destinations are the **published public test-vector addresses** from `docs/mainnet/MAINNET-VECTORS.md` (ripple fixture — public vectors, never funded, never receiving addresses). Amounts/fees are realistic mainnet values.
4. Each chain: build unsigned tx offline → `sign*` (AnySigner) → `verify*` independently → re-verify → decode the signed tx with the module's parsers and assert every field → preflight 11/11.
5. Run exit code **0**. (A first run exited 1 on my own wrong assertion that ETH `v` must be 0: with a fresh key the signature's y-parity was 1. For EIP-1559, `v` is the y-parity bit, 0 or 1; the script was corrected to assert parity and that decoded `yParity == v`. The corrected run is the one recorded here; its ETH `v` is 0.)

Fresh sender addresses for this run (public, unfunded, disposable):

```json
{"btc":"bc1qh3w6s7ph7rfvn4qpqjc7k0xh6cy0mlym2n4nxg","eth":"0x041b71f8D6dBed709399d9Ee983FA0D59973b73E","trx":"TU8b1vZbFLnvn4f6DzRJW74Eo5qY5qDS2K","ton":"UQB9KZPeH2wChzqrO1QbxYfvglOF0BhtRw9A0QYrjJsCZ7Lz"}
```

Change address (BTC): `bc1qh9sxd5dk8wyhvdyhtl9g8m057p8wy6e9fklyyr`.

## BTC — PASS

Construction inputs: 1 synthetic UTXO `3652927a9a58a63c037a2cb0285c0f1270567f974dd689d207b9caa1efe4ae43:0` = 50,000 sats (offline-only; signing proves nothing about unspentness or balance). Destination `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` (ripple fixture), amount 30,000 sats, byteFee 2 sat/vB. Signing method: `signBtc` → Wallet Core `AnySigner`, `TW.Bitcoin.Proto.SigningInput`, P2WPKH.

Verification output (verbatim):

```json
{"valid":true,"method":"bip143-ecdsa","version":1,"versionDeviation":true,"sighashes":["2901bace77b5bc3fcb4d7d7f66ce70eca94c89c5549ecbd705f86be7b1eecf42"],"feeSats":"282","outputs":[{"role":"payment","address":"bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd","valueSats":"30000"},{"role":"change","address":"bc1qh9sxd5dk8wyhvdyhtl9g8m057p8wy6e9fklyyr","valueSats":"19718"}]}
```

Preflight: 11/11 pass (`ISOLATION, NETWORK, DESTINATION, AMOUNT, FEE, CHANGE, NONCE-SEQUENCE-EXPIRY, REPLAY, SIGNED-MATCHES-APPROVED, SIGNATURE-VALID, NO-BROADCAST`), `passed: true`. Independent re-verification `verifyBtc` also `valid: true`.

Decoded-field check (`parseBtcSignedTx` on the signed tx, 444 hex chars): version 1, locktime 0, 1 witness with 2 items; outputs `30000` sats → script `00140c03e507f38033aca9ac5c32b32dce56051d097b` (destination program) and `19718` sats → script `0014b96066d1b63b897634975fca83edf4f04ee26b25` (change program) — both programs match the unsigned artifact. Fee check: 50,000 − 30,000 − 19,718 = **282 sats** = byteFee 2 × 141 vB = signed `feeSats`.

Known deviation (pre-existing, documented in the module): wallet-core emits version 1 while the unsigned artifact is version 2; the signature is valid for the signed transaction as-is (`versionDeviation: true`).

## ETH — PASS

Construction inputs: EIP-1559 type 2, chainId 1, nonce 7, destination `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` (ripple fixture), value 0.0025 ETH (`2500000000000000` wei), gasLimit 21,000, maxFeePerGas 30 gwei, maxPriorityFeePerGas 2 gwei, maxFeeWei `630000000000000`, data `0x`. Signing method: `signEth` → Wallet Core `AnySigner`, `TW.Ethereum.Proto.SigningInput`.

Verification output (verbatim):

```json
{"valid":true,"method":"ecrecover","signingHash":"f9023d5acf7860c885d42c8bbb441671507f97de83f9b9e218f8581c890b6a11","sender":"0x041b71f8D6dBed709399d9Ee983FA0D59973b73E","maxFeeWei":"630000000000000"}
```

Preflight: 11/11 pass, `passed: true`. Independent re-verification `verifyEth` also `valid: true`, sender `0x041b71f8D6dBed709399d9Ee983FA0D59973b73E` = the signer.

Decoded-field check (`parseEthSignedTx` on the 236-char `0x02…` encoded tx): chainId `1`, nonce `7`, to `0xa3dcd899c0f3832dfdfed9479a9d828c6a4eb2a7`, amountWei `2500000000000000`, gasLimit `21000`, maxFeePerGasWei `30000000000`, maxPriorityFeePerGasWei `2000000000`, yParity `0` (= signed `v`). All match the construction inputs and the approval.

## TRX — PASS

Construction inputs: owner `TU8b1vZbFLnvn4f6DzRJW74Eo5qY5qDS2K` → destination `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` (ripple fixture), amount 2,500,000 sun (2.5 TRX), `feeLimitSun: 0` (bandwidth-covered transfer; the route pins `maxFeeSun` to `0`), refBlockId `6fc473c1412038d4ecfd951d39809155e855cd8a41ed5ebde090553b8dc43abb` (fresh random), timestampMs `1763506000000`, expirationMs `1763509600000`. Signing method: `signTron` → Wallet Core `AnySigner`, `TW.Tron.Proto.SigningInput` (flat transaction + private key).

Verification output (verbatim):

```json
{"valid":true,"method":"secp256k1-recovery","txID":"b6d1f8904c125ff85363c098d3588511deeb3f1a3f71aa5584479103dde7f42e","ownerAddress":"TU8b1vZbFLnvn4f6DzRJW74Eo5qY5qDS2K","toAddress":"TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c","ownerHex":"41c7386288586460abfe91f7c7e235d2095fc8bb71","toHex":"4159b2f14f54513afa5b324aabd5c70362e7aa0836","refBlockBytes":"38d4","refBlockHash":"be0fb4ea52920564","refBlockHashDeviation":true}
```

Signature: 65 bytes (130 hex chars, `8dbe2a722714e32e6e61dde104e2beb9c49291b6a0e82954a52de81c7be29c8c…`). Preflight: 11/11 pass, `passed: true`. Independent re-verification `verifyTron` also `valid: true`, txID matches the signed txID.

Decoded-field check (own protobuf scan of the signed outer Transaction → `parseTronRawData`): txID `b6d1f8904c125ff85363c098d3588511deeb3f1a3f71aa5584479103dde7f42e` **equals SHA-256 of the signed raw_data**; owner re-derived from the parsed 21-byte address = signer `TU8b1vZbFLnvn4f6DzRJW74Eo5qY5qDS2K`; destination = `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c`; amount `2500000` sun; timestamp `1763506000000`; expiration `1763509600000`; refBlockBytes `38d4` (= refBlockId bytes 6–8). All match.

Known deviation (pre-existing, documented in the module): the signed `ref_block_hash` (`be0fb4ea52920564`) differs from the T33 fixture value — the signer derives it as SHA-256 of the BlockHeader protobuf, bytes 8–15 — while ref_block_bytes, contract, timestamp and expiration match exactly (`refBlockHashDeviation: true`).

### TRX trap — 33-byte compressed pubkey abort, re-confirmed first-hand

Separate process (`/tmp/trx-trap-probe.mjs`, fresh random key, Node v22.23.4, wallet-core 4.9.3):

- `PrivateKey.createWithData` → ok; `getPublicKeySecp256k1(true)` → ok, **33 bytes** (compressed).
- `CoinTypeExt.deriveAddressFromPublicKey(tron, compressedPubkey)` → **WASM runtime abort**: `Aborted(Assertion failed: Exception thrown, but exception catching is not enabled. Compile with -sNO_DISABLE_EXCEPTION_CATCHING …)`, surfacing as a `WebAssembly.RuntimeError`; the process exits 1 and the call never returns.
- This matches the `docs/mainnet/MAINNET-VECTORS.md` record. The signing path used above never hits it: `signTron` derives the owner address manually (own keccak256 + Base58Check, `publicKeyToTronAddress`) and `derive.js` uses the JS-first decompression / xpub route. **Do not call `deriveAddressFromPublicKey` for TRON with a private-key-derived compressed pubkey.**

## TON — PASS

Construction inputs: Wallet V4 R2, sender `UQB9KZPeH2wChzqrO1QbxYfvglOF0BhtRw9A0QYrjJsCZ7Lz` → destination `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` (ripple fixture), amount 120,000,000 nano (0.12 TON), seqno 5, validUntil `1800000000`, mode 3. Signing method: `signTon` → Wallet Core `AnySigner`, `TW.TheOpenNetwork.Proto.SigningInput`.

Verification output (verbatim):

```json
{"valid":true,"method":"ed25519","signingHash":"f41b507bc167f5bf8f3b97764baf6def8f670f351dd09764736cdd0189cc8b38","normalizedSigningHash":"e764975c01449aa1e372c1b212aa9a52a8f50e8a3741ffa4852a90f272e94985","signingHashDeviation":true,"signature":"ac5f3a17105f66d5a33339a5f4cd188cc144afa821cdcd833fc38d1f20914cc89c0be8d2ad7ff255abaf8c7f83b45f170b2f5d40b014954a3cbf19ff00eca907","sender":"UQB9KZPeH2wChzqrO1QbxYfvglOF0BhtRw9A0QYrjJsCZ7Lz","destination":"UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn","hasInit":false}
```

Preflight: 11/11 pass, `passed: true`. Independent re-verification `verifyTon` also `valid: true`. `verifyTon` itself checks the internal message destination hash, amount, seqno, validUntil, workchain 0, envelope destination = sender, and the Ed25519 signature — all against the unsigned artifact and the approval.

Decoded-field check (`parseTonBoc` on the signed BOC, 256 base64 chars, starts `te6`): 4 cells, rootIndex 0. The normalised signing hash `e764975c…` equals the unsigned artifact's signing hash exactly (the signer attaches an empty body cell, `hasBody` 1, where the unsigned artifact stores none — documented deviation, `signingHashDeviation: true`; the Ed25519 signature verifies against the signer's hash and the normalised hash matches).

## What this does NOT prove

- No balance, unspentness (BTC UTXO is synthetic), current nonce/seqno, block freshness or executability — offline cryptographic success proves none of those (the signing module states this boundary itself). The TRON `refBlockId` and timestamps are synthetic but format-valid; the TON seqno/validUntil are chosen values, not chain state.
- No apps/web signing capability: `local-sign` / `post-sign-verify` remain `blocked` in `apps/web/src/wallet/chains.ts` for all four chains. Wiring signing into the app is Phase 4 / Fix Lane 3 work, not this lane.
- No broadcast: nothing was sent to any network, and no real funds were involved at any point. The disposable keys were never funded and are not retained.

## Reproduction

```sh
cd /home/boxd/workspace/bawa-panel-rebuild/verify-sign   # branch panel-rebuild/verify-sign
node tools/verify-sign/run-verify-sign.mjs               # Node v22.23.4; exit 0; fresh keys each run
node --test tests/mainnet-signing.test.mjs               # baseline: 19 pass / 0 fail
```

Each run generates a new fresh mnemonic, so sender addresses, sighashes, signatures and txIDs differ run to run; the verdicts, verification methods and decoded-field matches are the stable claims.
