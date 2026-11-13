# Bawa — Offline unsigned native-asset transactions (T33)

## Purpose and safety boundary

`tools/mainnet-tx/unsigned-tx.mjs` builds **unsigned** native-asset
transactions for Bitcoin, Ethereum, TRON and TON from validated public
inputs, entirely offline. It exists so transaction preparation can be
developed, reviewed and regression-tested without ever moving funds.

The safety boundary is absolute:

- The module takes **public inputs only**. It never accepts a private
  key, mnemonic, seed phrase, signature or signed envelope. Closed
  schemas reject unknown fields, including any credential field.
- It performs **no network access, no filesystem access, no clock or
  randomness reads, and no persistence**. Node standard library only;
  no new dependencies.
- It contains **no send, broadcast, token-transfer, contract-call,
  allowance-approval or signing execution path**. Those six operations
  exist only as stubs that always throw:
  `Disabled operation: offline unsigned native transactions only.`
- Every artifact it returns is **unsigned and must never be broadcast
  by this module**. There is no broadcast function to call.
- Nothing in this document authorises a send, a broadcast, or any
  mainnet state change. M-35 execution remains a separate gate. Do not
  claim transaction execution or end-to-end payment is verified.

## Supported mainnets and formats

| Chain | Builder | Unsigned artifact |
|---|---|---|
| Bitcoin mainnet, P2WPKH | `buildBtcP2wpkhUnsignedTx` | Raw unsigned transaction template (version 2, empty scriptSigs, no witness section), plus signing metadata |
| Ethereum mainnet, chain ID 1 | `buildEthLegacyUnsignedTx` (EIP-155, type 0), `buildEth1559UnsignedTx` (type 2) | RLP signing preimage (`0x`-prefixed hex); type 2 with `0x02` prefix |
| TRON mainnet, native TRX | `buildTronMainnetUnsignedTransfer` | Serialised `Transaction.raw` protobuf, outer `Transaction` with only `raw_data`, and `txID` (SHA-256 of the raw data) |
| TON mainnet, Wallet V4 R2 | `buildTonV4R2UnsignedTransfer` | External-message BoC template (512-bit zero signature placeholder), standalone signing-cell BoC, signing-cell hash |

All builders are synchronous, deterministic, and take exactly one
closed-schema plain object. Invalid input throws `Error` before any
output is produced; there are no partial results.

Base units are integers as canonical decimal strings
(`0` or `[1-9][0-9]*`, no signs, fractions, exponents or whitespace;
parsed with `BigInt`): satoshis (BTC), wei (ETH), SUN (TRON),
nanoTON (TON).

## Caller-supplied context

Offline construction cannot verify live state. Every builder input is
a caller assertion:

- **BTC:** UTXOs are caller assertions. Their existence, unspent
  status, ownership and values cannot be verified offline. All
  supplied UTXOs are consumed in caller order; there is no coin
  selection. The fee is an absolute value, not a feerate; it is never
  estimated from the unsigned byte length.
- **ETH:** the nonce, balance, base-fee adequacy and block capacity
  are not checked. The recipient is validated for format and EIP-55
  checksum only; that cannot establish that it has no code.
- **TRON:** `refBlockId`, timestamps and expiry are format-validated
  synthetic inputs. The recipient is validated for format and
  distinctness only; offline construction cannot prove recipient
  account state. `feeLimitSun` must be `"0"` (native transfers do not
  use it as a bandwidth-fee ceiling; zero does not imply fee-free
  execution). `ref_block_num` is intentionally absent from the raw
  data; it is derivable from `ref_block_bytes` at preparation time.
- **TON:** the sender must be a deployed Wallet V4 R2 address, the
  seqno current, and the expiry fresh. None of these can be proven
  offline; they remain caller assertions. TON has no broadcast-ready
  unsigned Wallet V4 R2 external message: the BoC is explicitly a
  template with a 512-bit zero signature placeholder, excluded from
  the signing hash.

## Validation

- **BTC:** mainnet BIP-173 Bech32 P2WPKH only (42 characters,
  `bc` prefix, witness version 0, 20-byte program); mixed case is
  rejected; `changeAddress` is validated whenever supplied. UTXO
  `txid` is 64 hex characters, `vout` is 0–4,294,967,295, duplicate
  outpoints and the null coinbase outpoint are rejected, and each
  `scriptPubKey` must be exactly `OP_0` plus a 20-byte push. Amounts
  are at most 2,100,000,000,000,000 satoshis. The dust floor is a
  fixed local 294 satoshis: the payment must be at least the floor,
  `0 ≤ fee ≤ maxFee`, and a remainder of 1–293 satoshis is rejected
  rather than silently donated; a remainder of at least 294 requires
  `changeAddress`.
- **ETH:** `chainId` must be exactly numeric `1`; `data` must be
  exactly `"0x"` (native transfer only, empty access list for type 2).
  `to` must carry the exact EIP-55 checksum (all-lowercase and
  all-uppercase forms are rejected). Bounds: value 0–2²⁵⁶−1, nonce
  0–2⁶⁴−2, gas limit 21,000–16,777,216, `0 ≤ maxPriorityFee ≤ maxFee`,
  and `value + gasLimit × feeCap ≤ 2²⁵⁶−1`.
- **TRON:** `T` Base58Check addresses decoding to 25 bytes with
  version byte 65 and canonical re-encoding; owner and recipient must
  differ. Amount is 1–2⁶³−1 SUN. `refBlockId` is 64 lowercase hex
  characters. Expiry must be after the timestamp and at most 24 hours
  later.
- **TON:** sender tag 81 (non-bounceable `UQ`), destination tag 17
  (`EQ`) or 81, workchain 0, CRC16-XMODEM verified. Amount is a
  positive decimal string up to 2¹²⁰−1 nanoTON. `seqno` is
  0–4,294,967,295; `validUntil` is 1–4,294,967,295 (Unix seconds, no
  clock-derived default).

Accessor (getter/setter) properties are rejected everywhere.

## Disabled operations

These exports exist so any attempt to execute fails loudly at the
call site instead of silently doing nothing:

- `broadcastTransaction`, `sendTransaction`, `transferToken`,
  `callContract`, `approveAllowance`, `signTransaction`

Each synchronously throws `Error` with the exact message
`Disabled operation: offline unsigned native transactions only.`
before inspecting its arguments. There are no aliases, no bypass
options and no returned promises.

## Public fixtures

Only the published 15-word "ripple scissors…" test vector is used
(MAINNET-GUIDE §7). **Never fund these addresses: the mnemonic is
public and funding them is immediate loss.**

| Chain | Fixture sender | Fixture recipient |
|---|---|---|
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | `bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za` |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | `0xD6c3112a8Db4991a7359018F15e501dfEE316d59` |
| TRX | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | `TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B` |
| TON | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` (V4 R2, wallet ID 698983191) | bounceable form of the same account |

Golden vectors for these fixtures are frozen in
`tests/mainnet-unsigned-tx.test.mjs` and were verified first-hand
with independent decoders (bech32, RLP, protobuf, BoC/CRC32C);
evidence is in the T33 lane (`evidence/verify-01.txt`).

## Tests, gates and secret scan

Run the suite with Node 22:

```
node --test tests/mainnet-unsigned-tx.test.mjs
```

It is wired into `scripts/quality-gates.mjs` (`phase9-tests`), so the
full gates run it. It covers golden vectors, per-chain validation
negatives, disabled-operation assertions, independent fixture-address
checks, static no-execution scans of the module source, and an
offline check that runs the builders in a fresh process with network
APIs trapped. No test uses a real private key, mnemonic or seed: only
invalid secret sentinels and the public fixtures above.

`scripts/secret-scan.mjs` covers the new files. No secret material
may appear anywhere in this module, its tests or this document.
