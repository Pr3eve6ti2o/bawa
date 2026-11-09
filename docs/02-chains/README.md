# Chain guides

Worked examples in this document are in mainnet format unless labelled testnet.

## 1. Chain families: what changes and what does not

The common pattern is: secure a secret, then derive deterministic key material from it. After that, chains diverge: different curves; their own mnemonic and derivation schemes; smart-contract-defined accounts; account addresses versus UTXOs; multiple address and key formats per key. Rule: reuse the common cryptographic building blocks where the standard actually says they are reusable; use the chain's own reference implementation where the chain's semantics diverge.

## 2. Bawa scope: support is more than a coin type

Bawa supports watch-only address derivation for BTC, ETH, and TRX, and generation only for TON (one deposit address per wallet, no xpub derivation). Reference-only, NOT Bawa-supported: Solana (SOL) and Cardano (ADA). Listing a chain in the comparison table does not mean Bawa implements it.

Reference comparison table:

| Chain | Bawa scope | Coin type (SLIP-0044) | Path |
| --- | --- | --- | --- |
| EVM (Ethereum) | Supported, watch-only | 60 | `m/44'/60'/0'/0/x` |
| TRON | Supported, watch-only | 195 | `m/44'/195'/0'/0/x` |
| TON | Generation-only | 607 | `ton_path` from `CoinTypeExt.derivationPath(CoinType.ton)` |
| Solana | Reference-only | 501 | Wallet Core 4.9.2 registry paths: m/44'/501'/0' and m/44'/501'/0'/0'. |
| Cardano | Reference-only | 1815 | CIP-1852 payment `m/1852'/1815'/0'/0/0`; staking `m/1852'/1815'/0'/2/0` |

Curves and models: BTC secp256k1, UTXO; ETH/EVM secp256k1, account; TRX secp256k1, account; SOL Ed25519, account; ADA Ed25519, extended-UTXO (CIP-1852); TON Ed25519, smart-contract wallet accounts — one mnemonic can map to more than one account by contract plus wallet ID. A path string alone does not establish the curve, encoder, address format, wallet compatibility, or cross-chain compatibility.

Why this, and what breaks if you change it: the derivation policy per chain is fixed because each chain's address format, curve, and account model differ. Substituting another chain's path or coin type produces addresses on the wrong ledger or in the wrong format, and a restore that scans only the substituted path shows an empty wallet. Do not add alternative paths.

Reuse and configuration boundaries: reuse the mnemonic, seed, and secp256k1 key where the chain's standard says they are reusable. Configuration that belongs to the chain — network, chain ID, RPC endpoint, contract version, wallet ID, address format — is per-chain and never inherited from another chain.
## 3. Bitcoin

Bawa's intended format is [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) native SegWit P2WPKH. Use account `m/84'/0'/0'`, receiving path `m/84'/0'/0'/0/i` and `zpub` (SLIP-0132). Only native SegWit is intended for Bawa; the other formats below are BIP reference patterns. Coin type `0` does not choose the format.

| Format | Purpose | Path | Address prefix |
| --- | --- | --- | --- |
| Legacy P2PKH | [44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) | `m/44'/0'/0'/0/i` | `1...` |
| Nested SegWit P2SH-P2WPKH | [49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) | `m/49'/0'/0'/0/i` | `3...` |
| Native SegWit P2WPKH | [84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) | `m/84'/0'/0'/0/i` | `bc1q...` |
| Taproot P2TR | [86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) | `m/86'/0'/0'/0/i` | `bc1p...` |

The purpose level selects the script type. If you restore with the wrong purpose, you scan a different subtree and see an empty wallet, although the outputs have not moved. Keep the purpose with the format it names.

### Legacy P2PKH

To construct a legacy address, take the 33-byte compressed public key and compute `h = RIPEMD160(SHA256(pubkey))`. Form the payload `0x00 || h`, then take the first 4 bytes of `SHA256(SHA256(payload))` as the checksum. Base58-encode `payload || checksum` to get a `1...` address.

Version `0x00` gives the leading `1`; it is separate from coin type `0'`. The [BIP-381](https://github.com/bitcoin/bips/blob/master/bip-0381.mediawiki) locking script is:

```text
OP_DUP OP_HASH160 <h> OP_EQUALVERIFY OP_CHECKSIG
```

Use the [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) gap limit of 20 consecutive unused receiving addresses. “Unused” means no transaction history, not zero balance: an emptied address is still used.

Use this legacy descriptor template:

```text
pkh([<fingerprint>/44h/0h/0h]<account-xpub>/0/*)
```

Obtain Bitcoin Core's descriptor checksum before you import it.

The legacy account `xpub` at `m/44'/0'/0'` has a 78-byte payload containing, in order:

- Version `0x0488B21E`.
- Depth.
- Parent fingerprint: the beginning of the parent public key's HASH160.
- Child number.
- 32 chain-code bytes.
- A 33-byte compressed public key.

The payload plus 4 checksum bytes is Base58-encoded.

Treat your `xpub` as privacy-sensitive. It stores no transactions or balances. You cannot use it to reveal your seed or private keys, sign transactions, cross a hardened step or derive sibling accounts. It records no complete origin path or binding script policy.

SLIP-0132 lists `xpub` for P2PKH or P2SH. Re-encoding a BIP-84 key as `xpub` does not move it to BIP-44.

Base58Check excludes `0`, `O`, `I` and `l`. Each leading zero byte is preserved as a `1`. The checksum detects accidental corruption; it does not prove ownership.

### Nested SegWit (BIP-49)

For the [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) reference pattern, use purpose `49'`, account `m/49'/0'/0'` and receiving path `m/49'/0'/0'/0/i`.

Build the `redeemScript` as `00 14 <20-byte key hash>`. It is 22 bytes: `00` is witness version 0, and `14` pushes 20 bytes. Take its HASH160 to get a 20-byte script hash, then Base58Check-encode it with version `0x05` to get a `3...` address. The address encodes the redeem-script hash, not the public-key hash.

The locking script is:

```text
OP_HASH160 <script-hash> OP_EQUAL
```

At account `m/49'/0'/0'`, use `ypub` with version `0x049d7cb2`.

Nested SegWit was a compatibility bridge: older senders could pay a familiar `3...` destination without understanding native SegWit. Your receiving wallet still needed SegWit-aware derivation and spending.

If you restore while scanning only another purpose, your wallet finds no outputs and shows zero. Hardened `49'` and `84'` select different subtrees; the outputs have not moved.

In the BIP-49 testnet vector, `m/49'/1'/0'/0/0` gives `2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2`, with account prefix `upub`.
This vector uses the BIP-49 specification's mnemonic: "abandon" repeated 11 times, followed by "about".

Use this receiving descriptor:

```text
sh(wpkh([<MASTER_FINGERPRINT>/49h/0h/0h]<ACCOUNT_XPUB>/0/*))
```

Keep a separate `/1/*` change descriptor and add checksums to both descriptors.
### Native SegWit (BIP-84)

For [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), you use P2WPKH: pay to witness public key hash. The output script is `OP_0 <20-byte key hash>` (`0014<hash>`): witness version `0` plus `HASH160` of the compressed public key. When you spend it, put the signature and public key in the witness and leave `scriptSig` empty.

A mainnet P2WPKH address uses [Bech32 (BIP-173)](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki), starts with `bc1q` and has 42 characters, including a 6-character checksum. Use lower case only; mixed case is invalid. Validate both the checksum and the 20-byte witness program: `bc1q` alone does not identify P2WPKH. Witness version `0` uses Bech32, not [Bech32m (BIP-350)](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki).

[SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) assigns `zpub` version `0x04b24746`. The testnet forms are `tb1q…` for addresses under BIP-173 and `vpub…` for extended public keys under SLIP-0132.

`derive.js` uses `m/84'/0'/0'/0/i` for `btc`. To re-encode a `bc1q…` P2WPKH address as `tb1q…`, keep witness version `0` and the identical 20-byte witness program. Change the Bech32 HRP from `bc` to `tb` and recompute the checksum.

Core records Bitcoin HRP `"bc"` in [`registry.json`](https://github.com/trustwallet/wallet-core/blob/master/registry.json), while Bitcoin’s [`validateAddress` in `src/Bitcoin/Entry.cpp`](https://github.com/trustwallet/wallet-core/blob/master/src/Bitcoin/Entry.cpp) can accept encodings beyond that generation default. Check the HRP explicitly rather than treating successful validation as proof of mainnet.

### Taproot (BIP-86)

[BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) uses single-key P2TR with no script tree. Derive addresses at `m/86'/0'/0'/0/i`.

The internal point `P` is the even-y lift of the x-coordinate, as specified in [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki). Compute:

```text
t = int(tagged_hash("TapTweak", x(P)))
Q = P + tG
```

The `scriptPubKey` is `OP_1 PUSH32 <x(Q)>`: hex `5120` followed by 32 bytes. The address holds `x(Q)`, not `x(P)`. On mainnet, the HRP is `bc`; witness version `1` encodes as `p`, giving `bc1p…`. Use a [Bech32m checksum (BIP-350)](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki).

[SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) assigns **no Taproot-specific prefix**. Do not reuse a `zpub` for Taproot: it denotes P2WPKH. BIP-86 vectors use an ordinary [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) `xpub`; retain the origin path and P2TR policy alongside it.

Use `tr()` descriptors as specified in [BIP-386](https://github.com/bitcoin/bips/blob/master/bip-0386.mediawiki). The testnet template is:

```text
tr([<FPR>/86h/1h/0h]<ACCOUNT_TPUB>/0/*)#<CHECKSUM>
```

Obtain `<CHECKSUM>` with Bitcoin Core’s `getdescriptorinfo`.

For script-path multisig, use the more general `tr(INTERNAL,TREE)` form. This conceptual testnet-only example contains a two-of-three tapscript leaf:

```text
tr(<INTERNAL_KEY>,multi_a(2,<A>,<B>,<C>))
```

The leaf uses `OP_CHECKSIGADD` ([BIP-342](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki)). A key-path spend bypasses the leaf. Use joint key control for that path, or a [BIP-341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki) NUMS point if you intend no key-path spend. MuSig2 is a separate n-of-n protocol ([BIP-327](https://github.com/bitcoin/bips/blob/master/bip-0327.mediawiki)).

PSBT fields convey Taproot derivations, leaf scripts and control blocks ([BIP-371](https://github.com/bitcoin/bips/blob/master/bip-0371.mediawiki)).

### Descriptors and the UTXO model

Prefer descriptors to bare `xpub`s for watch-only, multisig and external-signer work. They retain the derivation origin, path and script policy. See [BIP-380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki), [BIP-381](https://github.com/bitcoin/bips/blob/master/bip-0381.mediawiki), [BIP-382](https://github.com/bitcoin/bips/blob/master/bip-0382.mediawiki), [BIP-383](https://github.com/bitcoin/bips/blob/master/bip-0383.mediawiki) and [Bitcoin Core’s `descriptors.md`](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md).

Your Bitcoin balance is the value of currently unspent outputs, not an integer stored on an address. A spending input consumes the **whole output**. Track outputs you own, exclude spent ones and sum each remaining outpoint once, in satoshis. Do not count lifetime receipts as a balance.

In a conceptual testnet example:

- You have two UTXOs: 40,000 + 25,000 sats = 65,000 sats.
- You spend the whole 40,000-sat output: 30,000 sats go to the payment, 9,000 sats return as change and 1,000 sats pay the fee.
- Afterwards, you have 34,000 sats: 25,000 untouched + 9,000 change.

UTXO totals are before fees.

Use the [Esplora API reference](https://github.com/Blockstream/esplora/blob/master/API.md) for these endpoints:

- `/address/:address/txs` — address transaction history.
- `/address/:address/txs/chain/:last_seen_txid` — pagination through confirmed history.
- `/address/:address/utxo` — unspent outputs.
- `/tx/:txid` — transaction details.
- `/tx/:txid/outspends` — output spending status.

With ElectrumX, use `blockchain.scripthash.get_history` and `blockchain.scripthash.listunspent` for history and UTXOs. Calculate the lookup key by taking SHA-256 of the locking-script bytes, reversing the digest bytes and hex-encoding the result. It is **not** a hash of the address text. Use `blockchain.transaction.get` for transaction data and `blockchain.scripthash.subscribe` for notifications.

Record the index tip. Re-query after notifications or when polling, and keep confirmed and pending amounts separate. Apply confirmation and maturity requirements before you call funds spendable.

### Mainnet versus testnet

[SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns Bitcoin coin type `0` and testnet coin type `1`. Use account paths `m/purpose'/0'/0'` for mainnet and `m/purpose'/1'/0'` for testnet, signet and regtest.

| Format | Mainnet | Testnet |
| --- | --- | --- |
| Legacy | `1…` | `m…` or `n…` |
| Nested SegWit | `3…` | `2…` |
| Native SegWit | `bc1q…` | `tb1q…` |
| Taproot | `bc1p…` | `tb1p…` |

Signet shares the testnet encoding ([BIP-325](https://github.com/bitcoin/bips/blob/master/bip-0325.mediawiki)). Regtest uses coin-type-`1'` paths with HRP `bcrt` ([SLIP-0173](https://github.com/satoshilabs/slips/blob/master/slip-0173.md)): `bcrt1q…` for [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) and `bcrt1p…` for [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki).

[SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) lists these testnet extended-public-key versions:

| Convention | Account path | Prefix | Version |
| --- | --- | --- | --- |
| [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) | `m/44'/1'/0'` | `tpub` | `0x043587cf` |
| [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki) | `m/49'/1'/0'` | `upub` | `0x044a5262` |
| [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) | `m/84'/1'/0'` | `vpub` | `0x045f1cf6` |

Re-encoding `zpub` as `vpub` does not derive the coin-type-`1'` account. SLIP-0132 also lists P2SH under `tpub`, so a prefix alone cannot prove purpose. Check the path and script together.

### Validation checklist

1. **Match the prefix to the intended purpose.** The pairs below are mainnet/testnet:
   - `44` — `1…` / `m…` or `n…`; `xpub` / `tpub`.
   - `49` — `3…` / `2…`; `ypub` / `upub`.
   - `84` — `bc1q…` / `tb1q…`; `zpub` / `vpub`.
   - `86` — `bc1p…` / `tb1p…`; `xpub` / `tpub`. [BIP-86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki) vectors use `xpub`; `tpub` is the [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) testnet counterpart. There is no Taproot-specific version.

2. **Validate the checksum and address form.** Use Base58Check for legacy and nested addresses and for extended keys, Bech32 for witness version `0`, and Bech32m for witness version `1`. Validate the witness version and program length. A valid checksum can still belong to the wrong network.

3. **Check account serialisation against purpose.** Keep the origin path and script policy alongside the extended key.

4. **Match the path’s coin type to the network.** Compare mainnet `m/84'/0'/0'/0/i` with testnet `m/84'/1'/0'/0/i`. The testnet stack here is a standards reference, not Bawa testnet support. Bawa’s derive tools hard-code mainnet `0'` paths; do not expect testnet addresses from them.

### Tool choices

- **Bitcoin Core** is the reference full node and wallet.
- **bitcoinjs-lib** separates transaction and address handling from HD-key functionality.
- **Blockstream Esplora** gives you address history, UTXOs, transaction details, mempool and blocks. You can self-host it.
- **ElectrumX** is an address-history index over a full node.
## 4. EVM chains

EVM is a family, not a single network: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Smart Chain, and Avalanche C-Chain. You reuse the mnemonic, seed, secp256k1 key, public key, and 20-byte address across the family. The chain ID, RPC endpoint, native gas asset, base/priority fee behaviour, block explorer, contract addresses, token contracts, network finality, supported RPC methods, and transaction rules are chain-specific.

Use `m/44'/60'/0'/0/i`; `60` is the Ethereum SLIP-0044 coin type. Do not derive a separate HD root per EVM chain. Derive the account once, then point the network runtime at the desired RPC and network.

To derive the address, take the 65-byte uncompressed public key and drop the `0x04` prefix to get `X||Y` (64 bytes). Hash those bytes with Keccak-256, **not SHA3-256**, and take the last 20 bytes.

For the EIP-55 mixed-case checksum, hash the 40 lowercase hex ASCII characters—not raw bytes—with Keccak-256. Uppercase each `a`–`f` where the corresponding hash hex digit is `8`–`f`, then add `0x` afterwards. Test vector: `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`.

EIP-155 includes the chain ID in replay protection: append `(chainId, 0, 0)`; `v` encodes it. EIP-1559 includes `chain_id` in the signed typed-transaction payload, with base-fee and priority-fee handling.

Chain IDs from the Wallet Core registry (mainnet):

| Network | Chain ID |
| --- | ---: |
| Ethereum | 1 |
| Optimism | 10 |
| BNB Smart Chain | 56 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Avalanche C-Chain | 43114 |
| Base | 8453 |

Coin type `60` is **not** a chain ID. Never replace `60'` with a chain ID or populate a transaction chain ID from the derivation path.

ENS is outside derivation. ENSIP-11 defines `0x80000000 | chainId` for ENS address-record coin types; Ethereum mainnet retains `60`. That mapping is for ENS resolution, not Bawa derivation.

**Per-network runtime checklist:** check each network independently.

- **Chain ID:** pin the expected value, compare it with the RPC `eth_chainId`, and use the matching value in transactions.
- **RPC endpoint:** verify chain identity and method support. Do not trust the name.
- **Block explorer:** use network-specific URL templates.
- **Native asset:** configure its name, symbol, and decimals. Do not inherit another network’s metadata.
- **Fee rules:** use legacy `gasPrice` or EIP-1559 caps and priority fees where supported. Run `eth_estimateGas` against the selected RPC and include network-specific extra charges.

Contract and token addresses are network-scoped. A wrong-network transfer can leave funds inaccessible or a deposit permanently uncredited. Replay protection cannot rescue a transaction correctly signed for the wrong intended network.

**Testnet check:** decode the RPC `eth_chainId` hex and compare it with the selected testnet’s configured signing ID—not the mainnet table and not `60`. Sepolia’s chain ID is `11155111` (live `eth_chainId`: `0xaa36a7`).

Tools: viem’s `mnemonicToAccount` (BIP-39 plus an HD path, `@scure/bip32`); [ethers](https://docs.ethers.org/v6/). For RPC methods, see [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/).

**Why this, and what breaks if you change it:** one account serves every EVM network because the address is chain-independent. If you derive per-chain roots or substitute a chain ID for coin type `60`, you create accounts that no other EVM wallet reproduces, and a restore on the standard path shows an empty wallet.

## 5. TRON

Use `m/44'/195'/0'/0/i`; `195` is the TRON coin type. The account public root is `m/44'/195'/0'`, with external branch `/0` and index `/i`, both non-hardened.

For the same key, TRON and Ethereum use the same secp256k1 point. Expand the compressed public key to 65 bytes (`0x04 || X || Y`). Hash `X||Y` only with Keccak-256—not NIST SHA3-256, not the compressed point, not the `0x04` marker, and not hex text—to get a 32-byte digest. The last 20 bytes are `H`, also the Ethereum address payload for the same key.

For TRON encoding, prepend `0x41` to get `P = 0x41 || H` (21 bytes). Append the first 4 bytes of `SHA-256(SHA-256(P))` to get 25 bytes. Base58-encode those bytes to get a 34-character address beginning with `T`.

The hex form is `41` plus 40 hex digits: 42 characters, with no `0x`. Removing the initial `41` recovers `H`. Ethereum displays `H` as `0x` plus 40 hex digits: `0x` is notation, while `41` is a real byte. Never obtain `H` by trimming characters from the Base58 address.

**Watch-only boundary:** `derive.js` and `derive_daemon.js` implement `trx` with `m/44'/195'/0'/0/i`, accept integer indices `0..2147483647`, and reject private extended keys.

**Validation checklist:**

- The Base58Check address starts with `T`.
- It is exactly 34 characters long.
- Its Base58Check checksum is valid.
- The decoded payload hex starts with `41`.

Do not stop at prefix plus length.

**Cross-network paste:** an Ethereum `0x` address in a TRON field fails TRON Base58Check validation: it has no `41` prefix and no Base58Check packaging. A TRON `T` address in an EVM field fails because it is Base58Check text, not 20-byte hex. Replacing `0x` with `T` is not a conversion.

For a dedicated TRON app, prefer a maintained TRON SDK or Wallet Core’s TRON functionality. Keep transaction construction and RPC TRON-specific.

**Why this, and what breaks if you change it:** TRON and Ethereum share the key but not the address encoding. If you paste one chain’s address text into the other’s field, validation fails and no transfer can be constructed. If you “convert” by editing the prefix, you produce an address that belongs to nobody.
## 6. TON

TON is generation-only in Bawa: you get one deposit address per wallet, with no xpub exported and no TON xpub watch-only flow. The single-address output is Bawa’s behaviour, not a TON protocol rule. `derive.js` and `derive_daemon.js` support `btc`, `eth` and `trx` only.

[TEP-3](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md) is the authority for wallet mnemonic schemes, Ed25519 keys, wallet smart contracts and subwallet/wallet-ID behaviour. Use the full compatibility model:

```text
mnemonic (the wallet's scheme)
  → Ed25519 key
  → wallet implementation
  → wallet contract version
  → wallet_id/subwallet config
  → workchain/network presentation
  → TON address
```

BIP-32’s secp256k1 extended-key machinery is not a drop-in interface for TON’s Ed25519 keys. Do not relabel a TON public key as a “TON xpub”.

`generate.js` records:

```javascript
ton_address = w.getAddressForCoin(CoinType.ton);
ton_path = CoinTypeExt.derivationPath(CoinType.ton);
ton_note = "single address per wallet; no xpub exported";
```

The literal path is `m/44'/607'/0'`: the account node, with no `/0/0`. The curve is `ed25519`.

The checks are:

```javascript
ok("coin_ton_607", CoinType.ton.value === 607);
ok("ton_valid", CoinTypeExt.validate(CoinType.ton, tonAddress));
```

`ton_valid` confirms that Core accepts the address for `CoinType.ton`. It does **not** compare it with the account selected by a separate receiving wallet.

`make_wallet.py` maps `ton_address` to `TON_DEPOSIT_ADDRESS` in `.env`. The `.env.example` template contains `TON_DEPOSIT_ADDRESS=`, with no placeholder text.

Populate it with the generated `ton_address`, verified in your intended receiving wallet before publication. A passing `ton_valid` check is not that verification.

Use the [official TON SDK documentation](https://docs.ton.org/applications/sdks) for tooling: TypeScript `@ton/core` for low-level work and `@ton/ton` for higher-level HTTP, Python `tonutils`, or Go `tonutils-go`.

Verify and monitor the intended account as follows:

1. Identify your intended wallet configuration: the exact contract version, `wallet_id`/subwallet configuration, workchain and network. If you are reconstructing the address, you also need the public key and version-specific initialisation parameters.
2. Use that configuration with your selected TON SDK. An address-only monitor queries an already verified address. Reconstruction needs the correct contract implementation and exact parameters, not a generic template.
3. Verify the address in that wallet before publishing it. Compare both the SDK result and Bawa’s `ton_address` with your intended wallet’s receiving account. If they disagree, stop and resolve the key-scheme or contract-configuration difference.
4. Monitor the verified account read-only, using account-state and transaction queries on the intended network. Keep the mnemonic and private key out of the watcher.

TON fixture, derived and independently verified on 2026-11-08 two ways — Trust Wallet Core 4.8.4 (`getAddressForCoin(ton)`) and an independent SLIP-0010 derivation (pure-stdlib Python + PyNaCl) cross-checked with @ton/ton (Core 4.8.4 — the Core 4.9.2 re-run was completed by D31 and recorded in the programme notes):

- Mnemonic: `ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal` (published Core test vector); passphrase empty.
- ed25519 public key (`m/44'/607'/0'`): `c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9`.
- `ton_path`: `m/44'/607'/0'`; coin 607; curve ed25519.
- Contract: Wallet V4 R2; wallet ID / subwallet `698983191` (0x29A9A317); workchain 0; seqno at derivation 0.
- Raw address: `0:bb819bc655d0b16613c06b3663e376da80171261f36fc1066899e8de98ce700f`.
- Non-bounceable (mainnet presentation): `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn`.
- Bounceable (mainnet presentation): `EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi`.
- Bounceable testnet: `kQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD5qo`; non-bounceable testnet: `0QC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD8dt`.
- The wallet ID was the missing configuration: V4R2 with wallet ID 0 gives a different address. Only V4R2 with wallet ID 698983191 matches.

TON cross-wallet compatibility with any specific wallet is not established.

A TON address depends on the contract version and wallet ID as well as the key. If you change either while keeping the same key, you get a different account. Funds sent to the unconfigured address are not visible in your intended wallet.

## 7. Solana (reference-only)

This section is reference-only: Bawa supplies no SOL derivation.

Solana uses coin type `501` (SLIP-0044), Ed25519 keys and an account model: addressed accounts hold lamport balances plus account data. See the [version-controlled account documentation](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/core/accounts/index.mdx).

The Wallet Core registry lists two wallet path forms:

Wallet Core 4.9.2 registry paths: m/44'/501'/0' and m/44'/501'/0'/0'.

Do not treat these paths as interchangeable. SLIP-0010 Ed25519 uses hardened-only child derivation; the extra `/0'` is another derivation step. Use your target wallet’s exact policy, including account numbering and import behaviour. Verify your results with published test material and known expected addresses for that wallet and path.

For new JavaScript work, use Solana Kit (`anza-xyz/kit`). `@solana/web3.js` 1.x is maintenance-only; the Foundation SDK repository, `solana-foundation/solana-web3.js`, is the authority for legacy v1.

Choose the RPC commitment per operation and set it explicitly. The [version-controlled RPC documentation](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/rpc/index.mdx) defines the levels:

- `processed`: the node processed it; the block may be on a discarded fork.
- `confirmed`: a supermajority voted; it is still not final.
- `finalized`: final after maximum vote lockout.

Keep provisional and finalised states distinct. Shared public endpoints are not for production and may return HTTP `429`. Plan production RPC capacity separately, with bounded retries and back-off.
## 8. Cosmos/IBC

Cosmos is not one chain with one endpoint — it is an ecosystem of sovereign chains with different chain IDs, address prefixes, fee tokens, gas pricing, modules, IBC paths, denoms, governance, and staking.

Representative Cosmos Hub path: `m/44'/118'/0'/0/i` — but the chain's own configuration is authoritative. The [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) tracks chain metadata, asset lists, endpoints, Bech32 prefixes, SLIP-0044 values, and IBC data.

JavaScript/TypeScript: CosmJS plus the Cosmos SDK ecosystem. Do not maintain a hand-written spreadsheet of chain IDs and prefixes for a production multi-chain app — use a maintained registry and still validate the particular chain's configuration.

## 9. Cardano (reference-only)

Reference-only: Bawa supplies no ADA derivation.

CIP-1852 Shelley-era hierarchy: `m/1852'/1815'/account'/role/index`. Roles are `0` external payment (receiving), `1` internal payment (change), `2` staking — sibling branches, not consecutive steps. Coin type `1815` (SLIP-0044).

BIP32-Ed25519 derivation (CIP-0003 wallet key generation); extended-UTXO (eUTXO) ledger — the `account'` component organises keys; it is not an Ethereum-style ledger account.

CIP-1854 covers multisig HD wallets with a separate layout; do not treat CIP-1852 as covering every Cardano wallet design. Changing an Ethereum BIP-32 implementation's coin type to `1815` cannot supply Cardano's rules. Use Cardano-native tooling.

Sources: [CIP-1852](https://cips.cardano.org/cip/CIP-1852), CIP-0003, CIP-1854 (cips.cardano.org), [Cardano eUTXO explainer](https://docs.cardano.org/learn/eutxo-explainer/).

## 10. Polkadot/Substrate

Polkadot and Substrate chains use their own key and derivation conventions. Crypto types: `sr25519`, `ed25519`, `ecdsa`. SS58 address formatting.

polkadot.js keyring Substrate URI model: `<mnemonic or mini-secret>//hard/soft///password`. Soft derivation is available for `sr25519`; it is conceptually different from BIP-32 hardened/non-hardened derivation. Use chain-native tooling where the crypto model or address encoding differs.

## 11. XRP Ledger

The XRP Ledger uses its own seed and account conventions, with more than one key type. JavaScript: the xrpl.js ecosystem plus the [official XRPL documentation](https://xrpl.org/docs/).

Use the existing wallet's exact seed/key type and derivation policy — “XRP uses BIP-44” is not enough to reconstruct an account.

## 12. Litecoin, Dogecoin and Bitcoin-like networks

These share building blocks (secp256k1, BIP-32-style derivation, BIP-44/49/84-like paths, UTXO accounting, Base58/Bech32-style encodings) — but the details still matter. Coin types from SLIP-0044: Litecoin `2`, Dogecoin `3`.

Use the actual network's documentation and test vectors before assuming a Bitcoin implementation is compatible. A mature multi-chain library (Trust Wallet Core) carries explicit per-chain registry data instead of dozens of copy-and-paste path and address rules.
## 13. Chain-selection decision table

| Chain | Bawa scope | Coin type (SLIP-0044) | Curve | Model | Derivation reference and authority | Address format and prefix | Actual tool behaviour |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BTC | Supported, watch-only | 0 | secp256k1 | UTXO | `m/84'/0'/0'/0/i`, BIP-84 | Native SegWit P2WPKH, Bech32 `bc1q…` mainnet | Watch-only derivation on exactly the shown route |
| ETH/EVM | Supported, watch-only (ETH) | 60 | secp256k1 | Account | `m/44'/60'/0'/0/i`, BIP-44 | 20-byte hex with `0x` | Watch-only ETH derivation on exactly the shown route |
| TRX | Supported, watch-only | 195 | secp256k1 | Account | `m/44'/195'/0'/0/i`, BIP-44 | Base58Check `T…` (hex begins `41`) | Watch-only derivation on exactly the shown route |
| TON | Generation-only | 607 | Ed25519 | Smart-contract wallet account | `ton_path` via `CoinTypeExt.derivationPath(CoinType.ton)` | Raw `<workchain>:<account-id-hex>`, or friendly Base64/Base64url (workchain 0 without the test-only flag: `EQ…` bounceable, `UQ…` non-bounceable) | Generates one deposit address per wallet; no xpub; no watch-only child derivation |
| SOL | Reference-only | 501 | Ed25519 | Account | Wallet Core 4.9.2 registry paths: m/44'/501'/0' and m/44'/501'/0'/0'. | Base58-encoded public key (no fixed textual prefix) | No derivation, generation, or signing |
| ADA | Reference-only | 1815 | Ed25519 with Cardano's extended-key scheme | Extended-UTXO | Payment `m/1852'/1815'/0'/0/0`; staking `m/1852'/1815'/0'/2/0` (CIP-1852) | Shelley Bech32 `addr1…` mainnet / `addr_test1…` testnet; reward `stake1…` / `stake_test1…` (CIP-19) | No derivation, generation, or signing |

The BTC/ETH/TRX entries are the derive tools' COMPLETE chain and path set. An ETH-shaped address does not establish support for another EVM network. `i` is a non-hardened address index; in SOL references, `x'` is a hardened account index.

### Derivation and network policy

Bawa's derivation policy is fixed per chain (`bawa-derivation-policy-v1`). The registry (docs/12) records what upstream ships; this section states what Bawa uses. Do not treat a registry derivation as a Bawa policy.

**Bitcoin testnet4 deviation.** Bawa pins Core's default mainnet SegWit derivation, selected explicitly in `generate.js`, and applies it to testnet4: account `m/84'/0'/0'`, receiving path `m/84'/0'/0'/0/i`, `zpub` serialisation. This is not the BIP-44/SLIP-44 testnet convention. The standards-conformant testnet pair under BIP-84 and SLIP-0132 is `m/84'/1'/0'/0/i` with `vpub` (`0x045f1cf6`). A standard BIP-84 testnet wallet following the coin-type-`1'` path derives different keys and addresses from the same mnemonic, so it will not discover Bawa-path addresses or any associated funds. Bawa's ordinary wallets use the coin-`0'` path, not Core's testnet entry. Core's registry labels its embedded testnet derivation `zpub`; report that label faithfully and state the standard value separately — do not assert that Core's `zpub` label is an alias for `vpub` bytes. Verify Core's actual testnet export behaviour before relying on it.

Complete testnet rows (SLIP-0132, labelled testnet):

| Prefix | Version bytes | Standard | Account path |
|---|---|---|---|
| `vpub` | `0x045f1cf6` | BIP-84 testnet | `m/84'/1'` |
| `tpub` | `0x043587cf` | BIP-44 testnet | `m/44'/1'` |
| `upub` | `0x044a5262` | BIP-49 testnet | `m/49'/1'` |

For the full SLIP-0132 table (mainnet and testnet rows), see docs/01.

**Re-encoding a testnet address.** To re-encode a `bc1q…` P2WPKH address as `tb1q…`, keep witness version `0` and the identical 20-byte witness program. Change the Bech32 HRP from `bc` to `tb` and recompute the checksum. Worked example: Bawa's `m/84'/0'` index-0 address `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` has witness program `0c03e507f38033aca9ac5c32b32dce56051d097b`; re-encoded it is `tb1qpsp72plnsqe6e2dvtsetxtww2cz36ztmrqny67`. The standards `m/84'/1'` program encodes to `tb1qq8p994ak933c39d2jaj8n4sg598tnkhnyk5sg5`. Changing an extended-key prefix re-encodes the same node; it does not move it onto another derivation path. With the same BIP-39 passphrase, a testnet wallet restricted to discovery under `m/84'/1'/…` derives a different account subtree and will not find Bawa's existing addresses or their spending keys there; those remain recoverable from the same seed using Bawa's `m/84'/0'/0'/…` path and testnet address encoding.

**TON naming.** Core 4.9.2 `registry.json` records symbol `GRAM`; SLIP-0044 records coin 607 as TON; Bawa uses TON. The registry entry is `ton`, coin ID 607.

**Chain IDs.** Sepolia's chain ID is `11155111`; the registry's Ethereum `chainId` value `1` is a mainnet reference value and must not be substituted for it. TRON has no chain/network-id field in the registry — that absence is not an ID of zero.

**Registry interpretation.** The registry's explorer URLs are mainnet defaults; use the guides' verified testnet endpoints (Web guide, Section E) for testnet work. The field reference warns that the chain ID "might not be always latest in registry. In transaction building current value has to be supplied each time." For registry-field interpretation and the addition procedure, see docs/12.


## 14. Keep the scheme and address decisions separate

Decide in this order: chain and network → curve and HD scheme → path and permitted key material → address encoder and wallet parameters → address. Public-derivation boundary: a BIP-32 account xpub covers non-hardened descendants (`/0/i`) but cannot cross a hardened step. SLIP-0010 Ed25519 has no public-child derivation — do not apply it indiscriminately; Cardano uses a different extended-key construction. Shared curves do not mean shared addresses. TON needs wallet parameters as well as key material. ADA roles are not interchangeable: a Shelley base address incorporates payment plus stake credentials; `/2/0` is staking, not another payment branch.

## 15. Mismatch diagnostics

1. Prefix mismatch — the exporter and importer disagree on script type, network, or serialisation. Check the export metadata (purpose `84'`, coin `0'`, account `0'`, branch `0`, index `i`, mainnet); an xpub does not prove purpose `44'`. Fix by re-exporting the intended account (or a compatible wallet); never by editing prefix text.
2. Zero balance after restore — discovery is on another path, account, branch, index range, or network, not necessarily an empty wallet. Reproduce the previously used address first. BIP-44 discovery stops after 20 consecutive unused external addresses. Bawa's derive paths cover only account `0'`, external branch `0` — not change branch `1` or other accounts. Fix with a wallet supporting the original scheme, and scan the relevant branches and range.
3. EVM address on the wrong network — a familiar address on another ledger. Verify the path (`44'/60'/0'/0/i`) and the network/chain ID; the address alone does not select the ledger. Select the intended network for inspection.
4. TRON text in an EVM field — shared secp256k1 mistaken for a shared address format. TRON is Base58Check over `0x41` plus 20 bytes, not EVM hex. Derive for the intended supported chain.
5. TON treated as an xpub receive tree — Bitcoin's public-child model applied to TON contract addresses. The Wallet Core reference path `m/44'/607'/0'` is not a Bawa xpub profile. Check the contract version, subwallet ID, workchain, and network; distinguish raw `workchain:hash` from friendly Base64/Base64url; use Bawa's generation-only flow.
6. Solana restored with the wrong wallet variant (reference-only) — verify purpose `44'`, coin `501'`, account `a'`, and the complete path (`m/44'/501'/a'` versus `m/44'/501'/a'/0'`). Preserve every hardened marker. The Base58 32-byte Ed25519 public key does not encode its network.
7. Cardano forced into a BIP-44 template (reference-only) — check `m/1852'/1815'/a'/0/i` (purpose `1852'`, coin `1815'`, account `a'`, receive role `0`, index `i`). Confirm the address type, staking credential, network ID, and Bech32 `addr`/`addr_test` serialisation. Byron restoration needs different rules.

## 16. Canonical sources

One primary source per chain family: Bitcoin — BIP-32/39/43/44/49/84/86 and SLIP-0010/0044/0132 (canonical <https://github.com/bitcoin/bips/blob/master/bip-XXXX.mediawiki> and <https://github.com/satoshilabs/slips/blob/master/slip-XXXX.md> forms); EVM — Ethereum JSON-RPC <https://ethereum.org/developers/docs/apis/json-rpc/> and ethers <https://docs.ethers.org/v6/>; TRON — the TRON developer documentation; TON — TEP-3 <https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md>; Solana — the version-controlled docs sources in <https://github.com/solana-foundation/solana-com>; Cosmos — the Chain Registry <https://github.com/cosmos/chain-registry>; Cardano — CIP-1852 <https://cips.cardano.org/cip/CIP-1852>; Trust Wallet Core — the registry <https://github.com/trustwallet/wallet-core/blob/master/registry.json> and the developer documentation home <https://developer.trustwallet.com/> (do NOT link the Wallet Core Usage Guide deep links — they land on the marketing homepage); Bitcoin Core descriptors — <https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md>; Esplora API reference — <https://github.com/Blockstream/esplora/blob/master/API.md>.

Regtest and signet appear in §3 as network encodings. The local-to-public testing sequence (local stage first, where a chain supports it) belongs in the Web and Android guides and in the repo testing taxonomy (docs/10) — not here.

Cross-reference note: docs/09 describes the BIP-84 testnet prefix `vpub` (not `tpub`) and the `m/84'/1'/0'` origin of EXTERNAL hardware signers following the standard testnet convention — not a Bawa-generated wallet (`m/84'/0'/0'`). Never mix the two origins.
