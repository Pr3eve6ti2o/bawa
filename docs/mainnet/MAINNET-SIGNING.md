# Mainnet Local Signing (T35)

Local-only signing of T33 unsigned transactions for Bitcoin, Ethereum,
TRON and TON, plus an 11-check preflight that runs before any signature
is produced. This module implements the W3 mainnet local-signing work.

> **STOP BEFORE BROADCASTING.** This module has no broadcast, send,
> submit or publish capability of any kind. Signing proves only that a
> correctly formed transaction for the approved request can be produced
> and independently verified offline. It proves **neither** that the
> sender has the balance, **nor** that the inputs are unspent, **nor**
> that the transaction would execute on-chain. Transaction execution
> and end-to-end payment are **not** verified. M-35 execution is a
> separate gate.

## Files

| File | Contents |
| --- | --- |
| `tools/mainnet-signing/local-signing.mjs` | Signing, independent verification, preflight, evidence records |
| `tests/mainnet-signing.test.mjs` | 14 tests (T1–T14) + fixture sanity |
| `tools/mainnet-guards/mainnet-guards.mjs` | T25 guard (isolation, redaction, destruction) — dependency |
| `tools/mainnet-tx/unsigned-tx.mjs` | T33 unsigned-transaction builders — dependency |

Signing uses `@trustwallet/wallet-core` **4.9.1** (pinned; see
`WALLET_CORE_VERSION`). The loader is memoised and resolves the
package relative to this module (`../hdwallet-gen/node_modules`), so
no other wallet-core version can be picked up accidentally.

## Entry points

```js
import {
  signBtc, signEth, signTron, signTon,
  verifyBtc, verifyEth, verifyTron, verifyTon,
  runPreflight, PREFLIGHT_CHECKS,
  buildEvidenceRecord, assertNoNetworkCapability,
} from './tools/mainnet-signing/local-signing.mjs';
```

Every `sign*` function takes `(unsigned, approval, privateKey,
isolation)` and returns a signed artifact whose `verification` field
is the result of running the matching `verify*` on the artifact just
produced, and whose `preflight` field is the result of `runPreflight`.
A signature is never returned without both passing.

Every `verify*` function takes `(signed, unsigned, approval, options
= {})` and returns `{ valid: true, ... }` or `{ valid: false, reason }`.
`options.skipSignature` verifies field-matching only (used by
preflight check 9); check 10 runs the same verifier with signatures
enabled.

## Credentials and isolation

- Temporary, randomly generated, **unfunded** test credentials only,
  inside T25 isolation. Never reuse personal or production wallets or
  existing seed phrases.
- `requireSigningAllowed()` calls the T25 guard
  `assertOperationAllowed` with `{ credentialKind:
  'temporary-unfunded', localOnly: true }`. If the guard forbids the
  operation, signing stops and the guard error is recorded; security
  controls are never weakened to make a test pass.
- `assertIsolation(isolation)` requires a live isolation handle
  (`dir`, `assertIsolated`, `credentialKind:
  'temporary-unfunded'`). Signing without one throws.
- Test keys are in-memory only, constructed as `Buffer.alloc(32)`
  with a small integer in the last byte. No literal 64-hex secrets
  appear in files.
- Signed payloads stay inside the T25 isolation directory. Only
  SHA-256 hashes and checklist results leave it (see
  `buildEvidenceRecord`).
- Temporary credentials are destroyed after testing with T25
  `destroyCredentialFile` (3-pass overwrite + fsync + unlink + dir
  fsync) and `verifyNoCopies` over the declared scope. Destruction
  and verification are recorded in the evidence record and in
  `REPORT.md`.
- All log lines pass through T25 redaction (`redactText`,
  `containsSecret`, `guardedLog`).

## Preflight checklist (11 checks, fail-closed)

`runPreflight(network, signed, unsigned, approval, isolation, extra)`
runs the checks in order and throws `PreflightError` (with `checkId`)
on the first failure. The checks are:

| # | Id | What it proves |
| --- | --- | --- |
| 1 | NETWORK | The signed artifact, unsigned artifact and approval name the same network |
| 2 | CHAIN-ID | Chain/network identity matches the approval (BTC mainnet bech32 `bc`, ETH chainId 1, TRON mainnet, TON mainnet) |
| 3 | DESTINATION | Payment/recipient addresses in the unsigned artifact and the signed artifact equal the approval |
| 4 | AMOUNT | Payment amount equals the approval exactly |
| 5 | FEE | Fee is within the approved maximum (`maxFeeSats` / `maxFeeWei` / `maxFeeSun`); TRON `feeLimitSun` is `"0"` |
| 6 | CHANGE | Change address and value match the approval; change is above the 294-sat dust floor (BTC) |
| 7 | NONCE-SEQNO | Nonce / sequence number equals the approval (ETH nonce, TRON `refBlockId`, TON seqno) |
| 8 | EXPIRY | Expiry is within the approved window (TRON expiration, TON `validUntil`) |
| 9 | SIGNED-MATCHES-APPROVED | The signed artifact re-decodes to the approved fields (`skipSignature` verification) |
| 10 | SIGNATURE-VALID | The signature verifies against the independently recomputed signing hash |
| 11 | NO-BROADCAST | The module exposes no broadcast/send/submit/publish entry point and its source contains no network imports, `fetch(`, or send-function definitions |

## Per-chain routes

### Bitcoin — `signBtc` / `verifyBtc`

- Unsigned artifact (T33): `{ unsignedTxHex, signingInputs, outputs,
  totalInputSats, feeSats, changeSats }`, version 2, locktime 0,
  sequence `0xffffffff`, P2WPKH inputs.
- Signing: wallet-core `Bitcoin.Proto.SigningInput` with the prevout
  script, value and the approved private key; `TW.Bitcoin.TransactionSigner.sign`.
- Fee: the signer fee is `byteFee × estimated vsize` (141 vB for the
  one-input two-output fixture), **not** the T33 `feeSats` input.
  Verification therefore compares signed outputs with the **approval**
  (payment amount and payment/change scripts exactly), not with the
  unsigned artifact's values, and requires
  `fee = totalInput − outputs ≤ maxFeeSats` and
  `change = totalInput − payment − fee`.
- Independent verification: own BIP-143 sighash implementation
  (`bip143Sighash`, over the signed version) + own secp256k1 ECDSA
  verify (`ecdsaVerify`, low-S enforced). The witness public key must
  hash to the approved prevout program.
- Fixture: input 30,000 sat (txid bytes `00`–`1f`, vout 0), pay
  `bc1qq6hag67dl53wl99vzg42z8eyzfz2xlkvxechjp` 20,000 sat, byteFee 1,
  maxFee 200 sat, change `bc1q0ht9tyks4vh7p5p904t340cr9nvahy7u3re7zg`.
  Signed fee **141 sat**, change **9,859 sat**.
- **Deviation — version:** wallet-core emits version **1**; the T33
  unsigned artifact is version 2. The sighash is computed over the
  signed version, so the signature is valid for the signed transaction
  as-is. Recorded as `versionDeviation: true` in the verification
  result; not treated as a failure.
- **Deviation — fee:** signed fee (141 sat) differs from T33's
  `feeSats` (200 sat) and the signed change (9,859 sat) differs from
  T33's `changeSats` (9,800 sat). Both are consequences of the
  byteFee × vsize fee model; the fee bound and the approval are what
  bind.

### Ethereum — `signEth` / `verifyEth`

- Unsigned artifact (T33): `{ chainId: 1, type: 2, signingPayloadHex }`
  — an EIP-1559 (type 2) unsigned envelope.
- Signing: wallet-core `Ethereum.Proto.SigningInput` (chainId 1,
  nonce, gas, maxFee, priority fee, to, value, data); signed
  `v = 0` (EIP-1559 y-parity 0).
- Independent verification: own RLP encode/decode, own keccak256,
  own secp256k1 recovery (`ecdsaRecover`) — the recovered sender must
  equal the approved sender (EIP-55 checksummed). The signing hash is
  recomputed from the unsigned payload independently of wallet-core.
- Fixture: sender `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`, to
  `0x000000000000000000000000000000000000dEaD`, value 0.001 ETH
  (`1000000000000000` wei), nonce 0, gas 21,000, maxFee 20 gwei,
  priority 1 gwei, maxFeeWei `420000000000000`.
- No deviations from the T33 artifact.

### TRON — `signTron` / `verifyTron`

- Unsigned artifact (T33): `{ network, rawDataHex,
  unsignedTransactionHex, txID }` with `refBlockId` as a
  format-validated synthetic fixture input and `feeLimitSun` `"0"`.
  The T33 artifact is consumed as-is; only its format is validated.
- Signing: the T33 `raw_data` is decomposed into the flat
  `TW.Tron.Proto.Transaction` message wallet-core expects
  (`{ timestamp, expiration, blockHeader, transfer, ... }` — a flat
  message, **not** the blockchain `Transaction{raw_data, signature}`
  shape). The signed outer `Transaction` is re-encoded by hand with
  protobuf varint length prefixes (field 1 `raw_data`, field 2
  `signature`).
- `ref_block_hash` is derived as SHA-256 of the BlockHeader protobuf,
  bytes 8–15; `ref_block_bytes` is the low 2 bytes of the block
  number, which **must** be passed as a decimal string (a JS number
  loses precision above 2^53 and yields `ref_block_bytes: 0000`).
- Independent verification: own protobuf field parser for `raw_data`,
  own secp256k1 recovery over the transaction hash — the recovered
  address must equal the approved owner — and `txID` recomputed as
  SHA-256 of the signed `raw_data`.
- Fixture: owner `TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC`, to
  `TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K`, amount 1,000,000 SUN,
  refBlockId `'11'.repeat(32)`, timestamp `1700000000000`,
  expiration `1700003600000`, feeLimitSun `'0'`; signed signature 65
  bytes.
- **Deviation — `ref_block_hash`:** T33 pins `ref_block_hash` directly
  from the fixture `refBlockId`, while the signer derives it from the
  BlockHeader protobuf, so the signed `raw_data` differs from T33's
  in `ref_block_hash` (and therefore `txID`). `ref_block_bytes`,
  contract, timestamp and expiration match exactly. Verification is
  field-level for TRON.

### TON — `signTon` / `verifyTon`

- Unsigned artifact (T33): `{ kind, unsignedBocBase64,
  signingBocBase64, signingHashBase64 }` — a V4R2 wallet signing cell
  (walletId 698983191) referencing an internal-message cell.
- Signing: wallet-core `TW.TheOpenNetwork.Proto.SigningInput`
  (namespace `TheOpenNetwork`, **not** `TON` — `TW.TON` is undefined
  in wallet-core 4.8.4). `Transfer.amount` is `Uint8Array` in the
  proto: the amount must be passed as minimal big-endian bytes of the
  nanotons value — a JS number is silently dropped and the signer
  builds a zero-amount message.
- Independent verification: own BOC parser (`parseTonBoc`, with the
  cell-hash function `tonCellHash`), own Ed25519 verify
  (`ed25519Verify` via Node `crypto` JWK). The signed BOC's envelope
  destination must equal the approved sender; the internal message's
  destination, amount, bounce flag and creation fields must equal the
  approval and the unsigned artifact.
- Fixture: sender
  `UQAkxuybaeBflbgYW3vgQvcFgyAQVcLtXZwdrpeLNqzZ0xDZ`, destination
  `UQBpuxKb5zcCDcKk-tJDY2YVM9RuG3igJjhls90VDnMPEQfa` (key 2's derived
  address), amount 50,000,000 nanotons (0.05 TON), seqno 1,
  validUntil `2000000000`, mode 3, walletId 698983191. Signed BOC
  starts `te6cckE`.
- **Deviation — empty-body encoding:** the T33 unsigned artifact
  stores the internal message with `hasBody = 0` and no ref, while
  the wallet-core signer stores `hasBody = 1` with a ref to an **empty**
  body cell. Both are valid TON encodings of "no message body", but
  they hash differently, so the signer's own signing-cell hash is not
  the T33 signing hash. Verification handles this by normalising the
  signed internal cell to the T33 encoding (clear the `hasBody` bit,
  drop the ref) and requiring the **normalised** internal hash to
  equal the unsigned artifact's internal hash — proving the empty-body
  encoding is the only difference — and the **normalised** signing
  hash to equal `signingHashBase64` exactly. The Ed25519 signature is
  verified against the signer's own (unnormalised) signing-cell hash.
  Recorded as `signingHashDeviation: true` with
  `normalizedSigningHash` in the verification result.
- **Quirk — all-zero destination:** the wallet-core signer encodes an
  all-zero destination hash as `addr_none`, dropping the destination
  entirely. The earlier fixture destination
  `UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ` (all-zero hash)
  therefore cannot be signed; the fixture uses a derived non-zero
  address instead. Any non-zero valid mainnet address works.
- **BOC parser note:** wallet-core never sets the d1 bit 3
  (`has_index`) flag; the bit length is derived from the d2 parity
  plus the completion-tag byte in the last data byte. The parser does
  not rely on d1 bit 3.

## Evidence record

`buildEvidenceRecord({ network, signed, unsigned, approval, preflight,
destruction })` returns an object containing **only** hashes and
checklist results — no secrets, no signed payload bytes. It is guarded
by the T25 secret scan (`containsSecret`): if any field contains a
secret, it throws. Fields:

- `network`, `method`, `signingHash` (SHA-256 hex of the signing
  payload), `signatureHash` (SHA-256 hex of the signature bytes),
  `signedArtifactHash` (SHA-256 hex of the signed artifact encoding),
- `preflight`: the 11 check ids with pass/fail,
- `verification`: `{ valid, method }` plus any recorded deviations
  (`versionDeviation`, `signingHashDeviation`).

The evidence file that wraps the per-chain records
(`evidence/t35-signing-evidence.json` in the T35 lane) adds a
top-level `credentials` section: the credential kind
(`temporary-unfunded`), the SHA-256 fingerprints of the temporary
keys, the per-file destruction results (`destroyed: true, bytes,
passes: 3` from T25 `destroyCredentialFile`), and the
`verifyNoCopies` results (pre-write and post-write sweeps).

## Broadcast-disable proof

`assertNoNetworkCapability()` scans this module's own source at
runtime for network imports (`http`, `https`, `net`, `dgram`, `ws`,
`fetch`, `XMLHttpRequest`, `WebSocket`), `require(` calls, `fetch(`,
and definitions of `broadcast` / `sendRawTransaction` /
`sendTransaction` / `submit` / `publish`. It throws if any is found.
Preflight check 11 runs the same scan plus an export check. The
module has no `broadcast`, `send`, `submit` or `publish` functions
and no network imports.

## Tests

`node --test tests/mainnet-signing.test.mjs` — 14 tests T1–T14 plus
a fixture-sanity test (15 total):

- T1 BTC happy path (fee 141, change 9,859, version deviation
  recorded, preflight 11/11)
- T2 ETH happy path (ecrecover matches sender, `v = 0`, preflight
  11/11)
- T3 TRON happy path (recovery matches owner, txID recompute matches,
  preflight 11/11)
- T4 TON happy path (Ed25519 verifies, normalised hash matches T33,
  preflight 11/11)
- T5 tampered payload after approval (amount → check 4; access list →
  check 9)
- T6 wrong chainId (Sepolia envelope → check 2)
- T7 wrong network (BTC testnet address in approval → check 2)
- T8 fee overrun (→ check 5)
- T9 unreviewed change (→ check 6)
- T10 broadcast-attempt refusal (no broadcast entry, no network
  tokens in module source)
- T11 secret redaction (planted key and mnemonic are redacted by T25
  patterns; evidence record contains no secret)
- T12 isolation gate (signing without an isolation handle, or with a
  revoked/expired handle, throws)
- T13 negative verification (one corrupted signature byte per chain →
  check 10 fails)
- T14 determinism (same fixture + same key signs to identical bytes
  twice; a different key fails the sender check)

The T25 guard suite (`tests/mainnet-guards.test.mjs`, 28 tests) and
the T33 unsigned-transaction suite (`tests/mainnet-unsigned-tx.test.mjs`,
25 tests) must still pass unchanged. The suite is wired into
`scripts/quality-gates.mjs` (`phase9-tests`).

## Limitations

1. Offline success proves neither balance, unspentness, nor
   executability. Nothing here touches a node, an explorer, or a
   broadcast endpoint.
2. TRON `ref_block_hash` / `txID` differ from the T33 artifact (see
   the TRON deviation above); verification is field-level.
3. BTC version 1 (signer) vs version 2 (T33 artifact), and signed
   fee/change differ from T33's `feeSats`/`changeSats` (see the BTC
   deviations above).
4. TON signing hash differs from the T33 signing hash by the
   empty-body encoding only (see the TON deviation above); the
   normalised hash matches exactly.
5. The TON all-zero destination address cannot be signed with this
   wallet-core version (see the TON quirk above).
6. TRON addresses are derived manually (keccak256 + Base58Check):
   `CoinTypeExt.deriveAddressFromPublicKey` aborts the WASM runtime
   for coin.tron. BTC/ETH derivation via that function works.
7. `TW.*` protobuf types are a package-level export of
   `@trustwallet/wallet-core`, not properties of the `initWasm()`
   instance (`core.TW` is empty).
