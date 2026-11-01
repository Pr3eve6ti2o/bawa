# Chain Guides

Read this before adding another blockchain. A coin type is not a complete wallet specification.

# Chain families: what changes and what does not

This is where many wallet guides become misleading.

The common pattern is:

```text
secure secret
    ↓
deterministic key material
```

But everything after that can diverge.

Some chains use secp256k1 and BIP-style paths that feel familiar.

Some use different curves.

Some use their own mnemonic or derivation scheme.

Some derive a blockchain account through a smart-contract definition rather than “just hash the public key”.

Some use account addresses rather than UTXOs.

Some ecosystems use multiple address/key formats for the same underlying key.

The correct approach is therefore:

> reuse the common cryptographic building blocks where the standard actually says they are reusable, and use the chain's own reference implementation where the chain's semantics diverge.

---

# Bitcoin

Bitcoin is the cleanest place to learn the HD-wallet model.

For Bawa's current implementation the intended account is:

```text
m/84'/0'/0'
```

and receiving addresses are:

```text
m/84'/0'/0'/0/i
```

That is BIP-84 / native SegWit (P2WPKH).

BIP-84 is here:

https://bips.dev/84/

The corresponding account serialization is `zpub` under SLIP-0132.

### The Bitcoin tool choices

**Want to understand Bitcoin itself?**

Use [Bitcoin Core](https://github.com/bitcoin/bitcoin).

It is the reference full-node/wallet ecosystem and gives you the deepest control over the network.

**Want a JavaScript library for Bitcoin transactions and address construction?**

Use [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib), together with its separated HD/key libraries where needed.

Its own README makes an important architectural point: modern bitcoinjs-lib separates transaction/address functionality from HD-key functionality rather than pretending one package should own everything.

**Want a fast indexed REST API for Bitcoin history?**

Use [Blockstream Esplora](https://github.com/Blockstream/esplora) or an Esplora-compatible service.

The Esplora API exposes address history, UTXOs, transaction details, mempool information and block data, and the project can also be self-hosted.

**Want your own Bitcoin address index server?**

Look at [ElectrumX](https://github.com/spesmilo/electrumx). It connects to a full node and indexes the chain so clients can query address history efficiently.

### Bitcoin's special tracking problem

Bitcoin is UTXO based.

A balance is not simply “an integer stored on the address”. It is the value of currently unspent outputs.

That means a tracker needs to understand:

```text
transaction
  ↓
outputs
  ↓
which outputs belong to us?
  ↓
which remain unspent?
  ↓
current spendable value
```

That is fundamentally different from an EVM account balance.

### Bitcoin descriptors

For serious watch-only or multisig work, do not stop at “I have an xpub”.

Bitcoin Core's descriptor wallet model can retain the derivation origin, path and script policy needed for proper watch-only and external-signer workflows.

See Bitcoin Core's [descriptor documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md).

---

# EVM chains

This is one of the most important sections in this entire guide.

### EVM is a family, not a single network

Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Smart Chain, Avalanche C-Chain and many other networks use the Ethereum Virtual Machine model or compatible account addressing.

For wallet derivation, that often means an Ethereum-style account can be derived once and the same 20-byte account address can be used on multiple compatible EVM networks.

But the **network is still different**.

What you can often reuse:

```text
mnemonic
seed
secp256k1 key
public key
20-byte EVM address
```

What you must treat as chain-specific:

```text
chain ID
RPC endpoint
native gas asset
base fee / priority fee behavior
block explorer
contract addresses
token contracts
network finality
supported RPC methods
transaction rules
```

Ethereum JSON-RPC is the standard node interface for reading and writing chain state. See the [Ethereum JSON-RPC documentation](https://ethereum.org/developers/docs/apis/json-rpc/).

### A common EVM path

A conventional path is:

```text
m/44'/60'/0'/0/i
```

The `60` is the Ethereum SLIP-0044 coin type.

Ethereum tooling can expose the same BIP-39 mnemonic as an HD account and let you select account/address indexes.

[viem](https://viem.sh/docs/accounts/local/mnemonicToAccount) currently documents `mnemonicToAccount`, based on BIP-39 plus an HD path, and internally uses `@scure/bip32` for BIP-32 derivation.

[ethers](https://docs.ethers.org/) is another mature choice for Ethereum application development and wallet handling.

### The most important EVM design rule

Do not derive a separate HD root merely because you added another EVM chain.

Usually you derive the account once, then the network-specific runtime points that account at the desired RPC/network.

But do not blindly assume that every EVM chain is operationally interchangeable. Smart-contract addresses, token contracts, native currency metadata, chain IDs and fee policies are still network-specific.

### EVM address encoding

An EVM address is normally represented as 20 bytes, commonly displayed in hexadecimal.

Mixed-case checksum formatting is specified by [EIP-55](https://eips.ethereum.org/EIPS/eip-55).

Transaction replay/domain semantics are affected by the chain ID under [EIP-155](https://eips.ethereum.org/EIPS/eip-155).

Modern fee handling is described by [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559).

These standards solve different problems. Do not turn “Ethereum” into one enormous undifferentiated wallet standard.

---

# TRON

TRON uses an Ethereum-like secp256k1 key foundation but has its own address encoding and network behavior.

A common HD policy is:

```text
m/44'/195'/0'/0/i
```

where `195` is the TRON coin type.

For Bawa, the account-level public root is treated as a watch-only input and addresses are derived at the external branch.

The important lesson is that **similar cryptography does not mean identical addresses**.

You still need TRON-specific address encoding and transaction/RPC behavior.

For a dedicated TRON application, prefer a maintained TRON-specific SDK or the relevant functionality inside Trust Wallet Core rather than rebuilding TRON address rules from Ethereum code.

---

# TON

TON deserves special treatment because it is very easy to oversimplify.

The TON wallet is not best understood as:

```text
mnemonic → one fixed address
```

TON's wallet guidelines define wallet mnemonic schemes, wallet smart contracts and subwallet/wallet-ID behavior. A single mnemonic/key can correspond to more than one TON account because wallet contract/configuration matters.

See [TON TEP-3: Guideline for TON Wallets](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md).

The practical model is closer to:

```text
mnemonic / key
      ↓
wallet implementation
      ↓
wallet contract version
      ↓
wallet_id / subwallet configuration
      ↓
workchain / network presentation
      ↓
TON address
```

This is exactly why a TON address can differ between wallets even when the user thinks they imported “the same seed”.

### Recommended TON repositories

Use the official TON ecosystem tooling listed in the [TON SDK documentation](https://docs.ton.org/applications/sdks).

For TypeScript:

- [`@ton/core`](https://github.com/ton-org/ton) / the current TON core ecosystem for low-level primitives;
- [`@ton/ton`](https://github.com/ton-org/ton) for higher-level HTTP-oriented interaction.

For Python/Go environments, TON's official SDK page also lists `tonutils` and `tonutils-go`.

Do not invent a fake “TON xpub” abstraction just to make TON look like Bitcoin.

---

# Solana

Solana is another place where the generic BIP-44 mental model can become misleading.

Solana account derivation commonly uses Ed25519 and ecosystem-specific derivation paths. Trust Wallet Core's current registry, for example, documents Solana derivation variants including:

```text
m/44'/501'/0'
```

and:

```text
m/44'/501'/0'/0'
```

That does **not** mean those are interchangeable for every wallet.

When interoperability matters, use the exact derivation policy of the target wallet and test it against known addresses.

### Recommended JavaScript runtime

The official Solana JavaScript SDK is moving toward **Solana Kit**. The current repository states that the 1.x `@solana/web3.js` branch is maintenance-only and that new development is happening in the newer Kit line.

Use:

- [Solana Kit](https://github.com/anza-xyz/kit) for new JavaScript application work;
- [the Solana Foundation SDK repository](https://github.com/solana-foundation/solana-web3.js) to understand the transition and legacy v1 compatibility.

### Solana RPC

Solana documents its RPC interface and explicitly warns that shared public RPC endpoints are not intended for production applications and may respond with rate-limit errors such as `429`.

See the [Solana RPC documentation](https://solana.com/docs/rpc).

Solana also exposes explicit commitment states such as `processed`, `confirmed` and `finalized`. Your tracker should choose deliberately rather than treating every observed transaction as final immediately.

---

# Cosmos / IBC

Cosmos is not one chain with one endpoint.

It is an ecosystem of sovereign chains, many of which use Cosmos SDK conventions but have different:

- chain IDs;
- address prefixes;
- fee tokens;
- gas pricing;
- modules;
- IBC paths;
- denoms;
- governance/staking semantics.

A representative Cosmos Hub path is:

```text
m/44'/118'/0'/0/i
```

but the chain's own configuration is still authoritative.

The [Cosmos Chain Registry](https://github.com/cosmos/chain-registry) is extremely useful because it tracks chain metadata, asset lists, endpoints, Bech32 prefixes, SLIP-0044 values and IBC data.

For JavaScript/TypeScript applications, look at [CosmJS](https://github.com/cosmos/cosmjs) and the surrounding Cosmos SDK ecosystem.

For a production multi-chain Cosmos application, do not maintain a hand-written spreadsheet of chain IDs and prefixes. Use a maintained registry and still validate the particular chain configuration you are connecting to.

---

# Cardano

Cardano is a good example of why “all HD wallets are BIP-44” is wrong.

CIP-1852 defines Cardano's Shelley-era HD wallet structure around:

```text
m / 1852' / 1815' / account' / role / index
```

and Cardano defines wallet-specific derivation and key-generation rules on top of the broader HD-wallet idea.

See:

- [CIP-1852 — Cardano HD wallets](https://cips.cardano.org/cip/CIP-1852)
- [CIP-0003 — Wallet key generation](https://cips.cardano.org/cip/CIP-0003)
- [CIP-1854 — Cardano multisig HD wallets](https://cips.cardano.org/cip/CIP-1854)

Do not take an Ethereum BIP-32 implementation and assume changing the coin type will produce a correct Cardano wallet.

Use Cardano-native tooling when Cardano is the actual target.

---

# Polkadot / Substrate

Polkadot and Substrate-based chains have their own key and derivation conventions.

The ecosystem supports cryptographic types including `sr25519`, `ed25519`, and `ecdsa`, and it uses SS58 address formatting.

The `polkadot.js` keyring documents the Substrate URI model:

```text
<mnemonic or mini-secret>//hard/soft///password
```

Soft derivation is available for `sr25519` pairs, which is conceptually different from the simple hardened/non-hardened BIP-32 story many people learn first.

See:

- [polkadot.js Keyring](https://polkadot.js.org/docs/api/start/keyring/)
- [Substrate URI documentation](https://polkadot.js.org/docs/keyring/start/suri/)

Again: use chain-native tooling where the cryptographic model or address encoding differs.

---

# XRP Ledger

The XRP Ledger ecosystem has its own seed/account conventions and supports more than one key type.

For JavaScript applications, use the maintained [xrpl.js](https://github.com/XRPLF/xrpl.js) ecosystem and the official [XRPL documentation](https://xrpl.org/docs/).

The official JavaScript getting-started guide shows how to connect to the ledger, create/import wallets, query accounts and subscribe to ledger activity.

When interoperating with an existing wallet, use its exact seed/key type and derivation policy. Do not assume that “XRP uses BIP-44” tells you enough to reconstruct an account.

---

# Litecoin, Dogecoin and Bitcoin-like networks

Bitcoin-family networks often feel familiar because they reuse some of the same building blocks:

- secp256k1;
- BIP-32-style derivation;
- BIP-44/BIP-49/BIP-84-like paths;
- UTXO accounting;
- Base58/Bech32-style encodings.

But the details still matter.

Coin type assignments such as Litecoin `2` and Dogecoin `3` come from the SLIP-0044 registry. Use the actual network's documentation and test vectors before assuming a Bitcoin implementation is compatible.

For a multi-chain library, this is exactly where a mature library such as Trust Wallet Core becomes useful: it already contains explicit per-chain registry data instead of forcing you to write dozens of copy-and-paste path and address rules.

---

## Canonical sources

- [Bitcoin Core](https://github.com/bitcoin/bitcoin)
- [Trust Wallet Core](https://github.com/trustwallet/wallet-core)
- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)
- [Solana Kit](https://github.com/anza-xyz/kit)
- [TON TEP-3](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md)
- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)
- [Cardano CIP-1852](https://cips.cardano.org/cip/CIP-1852)
- [polkadot.js](https://polkadot.js.org/docs/api/start/keyring/)
### Bitcoin formats: one coin type, four choices

Bitcoin is coin type `0` in Bawa’s mapping. That does **not** choose the address format. Match an explicit format requirement. Bawa does not document wallet-compatibility guarantees, so check the target wallet’s documentation before choosing a format.

```text
Bitcoin — coin type 0
↓
format choice still required
├─ legacy
├─ nested SegWit
├─ native SegWit
└─ Taproot
```

```text
Bawa's intended selection
↓
BIP-84
↓
native SegWit
↓
P2WPKH

account:                m/84'/0'/0'
receiving:              m/84'/0'/0'/0/i
account serialisation:  zpub under SLIP-0132
```

#### Per-format reference

The paths, address types and prefixes below follow [BIP-44](https://bips.dev/44/), [BIP-49](https://bips.dev/49/), [BIP-84](https://bips.dev/84/) and [BIP-86](https://bips.dev/86/). For these Bitcoin reference patterns, the account level is `m/purpose'/0'/0'`.

Compare the requested format with the table. **You should see:** the corresponding purpose and prefix pairing below. These are reference patterns, not complete addresses or command output.

| Format | Purpose | Full receiving path | When to select | You should see: |
|---|---:|---|---|---|
| Legacy (P2PKH) | `44` | `m/44'/0'/0'/0/i` | An explicit legacy-format requirement | `1...` prefix |
| Nested SegWit (P2SH-P2WPKH) | `49` | `m/49'/0'/0'/0/i` | An explicit nested-SegWit requirement | `3...` prefix |
| Native SegWit (P2WPKH) | `84` | `m/84'/0'/0'/0/i` | Bawa’s intended Bitcoin format | `bc1q...` prefix |
| Taproot (P2TR) | `86` | `m/86'/0'/0'/0/i` | An explicit Taproot requirement | `bc1p...` prefix |

Only the native SegWit row describes Bawa’s intended format. The other three rows are BIP reference patterns to help you recognise a format requirement, not Bawa defaults. Bawa does not document compatibility, fee or migration comparisons; check the target wallet’s documentation and current fee information before making those decisions.

#### Maintainer checks

1. **Compare the intended Bawa configuration with the BIP-84 paths above.**  
   **You should see:** account `m/84'/0'/0'` and receiving template `m/84'/0'/0'/0/i`. `zpub` belongs to the account serialisation under SLIP-0132; `bc1q...` is the address-prefix pattern.

2. **Review any format selection based only on coin type.**  
   **You should see:** the same Bitcoin coin type, `0`, associated with all four purposes and their different prefixes. Coin type alone leaves the format unresolved.

3. **Check the relevant standard before using another full path.**  
   **You should see:** the legacy, nested SegWit and Taproot paths identified as BIP-44, BIP-49 and BIP-86 reference patterns, not Bawa defaults. Do not assume that replacing `84` also changes the address encoder or account serialisation. Check the implementation’s documented support before using another format.

#### Evidence boundary

| Specification | Status |
|---|---|
| Full account and receiving paths for purposes `44`, `49` and `86` | BIP-44, BIP-49 and BIP-86 define these reference patterns. The corresponding accounts are `m/44'/0'/0'`, `m/49'/0'/0'` and `m/86'/0'/0'`; the receiving paths are in the table above. These are not Bawa defaults. |
| Network labels and testnet paths/prefixes | Bawa does not document these. Check the relevant Bitcoin network specifications and the target wallet’s documentation before using a test network. |
| Address-encoder/checksum rules and script details beyond identifying Bawa’s format as P2WPKH | Bawa does not document these rules. Consult the relevant BIP and its referenced specifications before implementing address encoding or script handling. |
| Account serialisations for the other formats | Bawa documents `zpub` for its BIP-84 account, but not serialisations for the other formats. Check the relevant BIP, SLIP-0132 and the target wallet’s documentation rather than assuming `zpub` applies. |
| Wallet support, fee trade-offs and migration guidance | Bawa does not document these. Check the target wallet’s support and migration documentation, along with current fee information. |
| Executable derivation or signing procedure | Bawa does not document an executable procedure here. Follow your chosen implementation’s documented procedure and verify its behaviour against published test vectors before relying on it. |

A shared Bitcoin coin type does not make paths, address encoders or account serialisations interchangeable. Follow the standard for the chosen format. This section is a format reference, not a signing recipe, fee comparison or migration guide.

---

- [XRPL.js](https://github.com/XRPLF/xrpl.js)

## 02 Chains — support is not just a coin type

Bawa supports watch-only address derivation for BTC, ETH and TRX; TON support is limited to generating one deposit address per wallet.  
**Reference-only — not Bawa-supported:** Solana (SOL), Cardano (ADA).

Listing a chain in the comparison table does not mean Bawa implements it. The paths below are references, **not confirmed Bawa defaults** or signing instructions.

```text
Common outline
secure secret
    ↓
deterministic key material
```

```text
Chain-specific decisions — conceptual, not Bawa syntax
curve + derivation scheme
    ↓
key format + UTXO / account / contract semantics
    ↓
address format + encoder
```

### Reference comparison

| Chain | Bawa scope | Coin type | Derivation reference |
|---|---|---:|---|
| EVM | Supported | 60 | `m/44'/60'/0'/0/x` |
| TRX | Supported | 195 | `m/44'/195'/0'/0/x` |
| TON | Generation only: one deposit address per wallet; no xpub derivation | 607 | Recorded as `ton_path` from `CoinTypeExt.derivationPath(CoinType.ton)` |
| SOL | Reference-only | 501 | Phantom/Solflare: `m/44'/501'/x'/0'`<br>Trust/Sollet: `m/44'/501'/x'` |
| ADA | Reference-only | 1815 | CIP-1852 payment: `m/1852'/1815'/0'/0/0`<br>Staking: `m/1852'/1815'/0'/2/0` |

The EVM and TRX reference paths have the same shape, with different coin types. SOL has two wallet-specific forms; ADA distinguishes payment and staking. A single “change the coin type” template does not cover these differences.

`generate.js` creates and validates one TON address per wallet. It records `ton_address`, `ton_path` and `ton_note` (`single address per wallet; no xpub exported`), and exports no TON xpub or zpub. `make_wallet.py` maps `ton_address` to `TON_DEPOSIT_ADDRESS` in `.env`. There is no TON xpub watch-only derivation flow in Bawa: neither `derive.js` nor `derive_daemon.js` supports TON, so you cannot derive TON addresses from a TON xpub with these tools.

### Curves, schemes and address models

Keep these distinctions clear:

- secp256k1 with BIP-style paths versus schemes using other curves;
- shared cryptographic building blocks versus chain-specific mnemonic or derivation schemes;
- UTXO models versus account models, including accounts defined by smart contracts;
- key and address formats, which can differ for the same underlying key.

According to BIP/SLIP standards and the chains’ own documentation:

- **BTC** uses secp256k1 and a UTXO model.
- **ETH/EVM chains** use secp256k1 and an account model.
- **TRX** uses secp256k1 and an account model.
- **SOL** uses Ed25519 and an account model.
- **ADA** uses Ed25519 and an extended-UTXO model, with paths defined by CIP-1852.
- **TON** uses Ed25519 and smart-contract wallet accounts. One mnemonic can correspond to more than one account, depending on the wallet contract and wallet ID.

Bawa does not document complete derivation algorithms, public-key serialisation rules, address encoders or the cryptographic details behind ADA’s CIP-1852 paths. Consult the relevant BIP/SLIP standards, CIP-1852 for ADA, and the chain’s own documentation or reference implementation for those details.

For any chain, a path string alone does not establish the curve, encoder, address format, wallet compatibility or compatibility with another chain. Check the chain’s own reference for each of these.

### Reuse and configuration boundaries

Reuse cryptographic building blocks **only where the relevant standard permits it**. Where chains follow different rules, use the chain’s own reference implementation rather than treating a new coin type as the only change.

Use the second diagram as a review checklist for a proposed chain profile. It is not a Bawa configuration schema. The curve and derivation scheme, path, key format, account or contract rules, and encoder remain separate decisions.

Bawa does not document configuration syntax, encoder APIs, per-network settings or verified address outputs for proposed chain profiles. EVM is a family, not a single network; Bawa does not document per-network EVM configuration. Check the target network’s documentation and reference implementation, and review the relevant Bawa code before configuring a profile.

**Review checkpoint:** compare a proposed profile with the table.

**You should see:** EVM/TRX labelled supported; SOL/ADA still reference-only; TON labelled as single-deposit-address generation only, coin type `607`, its path recorded in `ton_path`, and `TON_DEPOSIT_ADDRESS` set in `.env`; no TON xpub export or watch-only derivation flow; no encoder selected merely from a coin type.

### What is not in Bawa scope

**SOL and ADA implementations are outside the Bawa-supported scope here.** Their reference paths do not imply Bawa derivation, address generation or signing support.

For EVM/TRX/TON, Bawa does not document runnable commands, RPC behaviour, transaction building or signing capabilities for these reference profiles, nor an executable wallet workflow or signing example. This does not confirm that those capabilities are absent. Check the relevant Bawa tool documentation and code before attempting a wallet workflow or signing.

# Bitcoin

Start with Bitcoin to make the HD-wallet model concrete.

**Bawa code:** the current intended account is `m/84'/0'/0'`, receiving at `m/84'/0'/0'/0/i`. Under [BIP-84](https://bips.dev/84/), this is native SegWit, P2WPKH; [SLIP-0132](https://slips.readthedocs.io/en/latest/slip-0132/) assigns its `zpub` serialisation. The legacy account below is separate, not a replacement for that intention.

## Legacy receiving: BIP-44 and P2PKH

[BIP-44](https://bips.dev/44/) defines the hierarchy; [SLIP-0044](https://slips.readthedocs.io/en/latest/slip-0044/) allocates coin type `0` to Bitcoin. Read the legacy receiving path, `m/44'/0'/0'/0/i`, one level at a time:

```text
m — master node
  ↓
44' — BIP-44 purpose
  ↓
0' — Bitcoin coin type
  ↓
0' — account zero
  ↓
0 — external, receiving chain
  ↓
i — address index, starting at zero
```

Under [BIP-32](https://bips.dev/32/), an apostrophe marks hardened derivation. BIP-44 hardens the first three levels, but leaves the branch and address index unhardened. Address indices run from zero to `2³¹ − 1`. Branch `1` is internal change, giving `m/44'/0'/0'/1/i`.

BIP-32 therefore lets an account xpub at `m/44'/0'/0'` derive receiving and change public keys without signing authority. SLIP-0132 records `xpub` for this legacy mainnet convention. An xpub is not a payment address.

### Why coin type zero does not select the format

[BIP-43](https://bips.dev/43/) and BIP-44 separate **purpose** from **coin type**. Coin type `0'` identifies Bitcoin’s namespace; it does not request P2PKH.

SLIP-0132 records the conventional association between purpose `44'` and legacy P2PKH. BIP-84 uses purpose `84'` for P2WPKH while retaining the same Bitcoin coin type. BIP-44 itself defines a hierarchy, not an address-encoding rule: the wallet must also select the matching script policy.

Under BIP-32, changing the purpose changes the derivation. Renaming an export or swapping its prefix does not derive the other account.

## From child public key to `1...`

**Authority: BIP-32 and Wallet Core’s [BitcoinAddress API](https://trustwallet.github.io/docc/documentation/walletcore/bitcoinaddress).** Derive the receiving child’s compressed secp256k1 public key, then construct the mainnet P2PKH address:

```text
33-byte compressed public key
  ↓
h = RIPEMD160(SHA256(public_key))
  ↓
payload = 0x00 || h
  ↓
checksum = first 4 bytes of SHA256(SHA256(payload))
  ↓
Base58(payload || checksum)
  ↓
1... — address placeholder
```

Here `||` joins bytes. This is Base58Check encoding. The address carries a versioned 20-byte public-key hash, not the public key or derivation path. Address version `0x00` produces the leading `1`; it is entirely separate from coin type `0'`.

[BIP-381](https://bips.dev/381/) defines the corresponding P2PKH locking script:

`OP_DUP OP_HASH160 <h> OP_EQUALVERIFY OP_CHECKSIG`

P2PKH means “pay to public key hash”.

## Track outputs and retain policy

**Authority: Wallet Core’s [usage guide](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage).** Bitcoin tracking follows unspent transaction outputs, unlike an EVM account’s stored balance:

```text
transactions
  ↓
outputs
  ↓
outputs matching our scripts
  ↓
outputs not subsequently spent
  ↓
spendability checks
  ↓
currently spendable value
```

For discovery, BIP-44 uses a gap limit of 20 consecutive unused receiving addresses. Transaction history determines use: an address emptied by spending is still used.

Under [BIP-380](https://bips.dev/380/) and BIP-381, descriptors can retain key origins, derivation paths and script policy. Prefer them to bare xpubs for dependable watch-only, multisig and external-signer workflows; see [Bitcoin Core’s descriptor documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md).

A legacy receiving template is `pkh([<fingerprint>/44h/0h/0h]<account-xpub>/0/*)`. Here `h` denotes hardening; angle-bracketed values are placeholders. Obtain Core’s descriptor checksum before importing.

**You should see:** receiver zero at `m/44'/0'/0'/0/0`, a mainnet address beginning `1`, and a `pkh(...)` watch-only policy. Bawa’s intended `84'` account remains separate.

Bitcoin is a useful first stop: separate key derivation from output tracking. Bawa’s intended account remains `m/84'/0'/0'`, receiving at `m/84'/0'/0'/0/i` (Bawa code). This is native SegWit P2WPKH under [BIP-84](https://bips.dev/84/), with `zpub` account serialisation under [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md). The legacy comparison below does not replace that choice.

## Legacy account public root: `xpub`

[BIP-44](https://bips.dev/44/) places the first legacy Bitcoin account at `m/44'/0'/0'`: purpose `44'`, Bitcoin coin type `0'`, account `0'`. Apostrophes mark hardened steps. Relative to that account, receiving keys use `/0/i`; change keys use `/1/i`. Both suffixes are non-hardened.

The account’s `xpub` is its public-only, or *neutered*, [BIP-32](https://bips.dev/32/) extended key—not a payment address. BIP-32 serialises a 78-byte payload, in this order:

- Four version bytes: `0x0488B21E` for mainnet `xpub`, also registered by SLIP-0132.
- One depth byte.
- Four immediate-parent fingerprint bytes: the beginning of that parent public key’s HASH160.
- Four child-number bytes.
- 32 chain-code bytes.
- A 33-byte compressed secp256k1 public key.

BIP-32 appends four checksum bytes before Base58 encoding. The chain code supplies public derivation material; it is not a private key.

BIP-32 public derivation lets a holder generate non-hardened descendant public keys. With BIP-44’s branch convention and P2PKH policy, a blockchain watcher can link receiving and change addresses. The xpub itself stores no transactions or balances. Treat it as privacy-sensitive.

By itself, it cannot reveal the seed or private keys, sign, cross a hardened step or derive sibling accounts. It records no complete origin path or binding script policy: SLIP-0132 lists `xpub` for P2PKH **or P2SH**. Re-encoding a BIP-84 key as `xpub` does not move it to BIP-44.

BIP-32 also gives an important warning: an xpub combined with a leaked private key from a known, entirely non-hardened descendant path can compromise the account private key.

## Base58Check for `1...` addresses

For legacy P2PKH, hash the **derived child public key**, not the xpub text. BIP-32 defines the public-key HASH160 relationship; SLIP-0132 identifies the legacy mapping and publishes address vectors; [BIP-13](https://bips.dev/13/) documents the shared Base58Check envelope and checksum rule.

```text
33-byte compressed child public key
  ↓ SHA-256, then RIPEMD-160
20-byte public-key hash
  ↓ prepend mainnet P2PKH version 0x00
21-byte payload
  ↓ append first four bytes of SHA256(SHA256(payload))
25-byte checksummed data
  ↓ Base58 encode
1... address
```

Base58 represents the bytes as a big-endian integer using 58 symbols, excluding `0`, `O`, `I` and `l`. Each leading zero byte is preserved as `1`; the `0x00` version therefore gives these mainnet addresses their `1...` start. These are encoding rules, not encryption (BIP-32; BIP-13’s referenced Base58Check format).

The checksum covers the version and hash, not their textual spelling. Validation decodes the address, separates the final four bytes, recomputes the double-SHA-256 checksum and compares them. Check the version and payload length separately. This helps detect accidental corruption, not ownership or authenticity: anyone can recompute a checksum. An xpub uses the same checksum method over its own 78-byte payload (BIP-13; BIP-32).

## Tracking and script policy still matter

Bitcoin accounting follows owned, unspent transaction outputs, not an EVM-style account counter ([BIP-174](https://bips.dev/174/), UTXO fields):

```text
transactions
  ↓
candidate outputs
  ↓
outputs matching our derived scripts
  ↓
outputs still unspent
  ↓
total unspent value
```

For watch-only, multisig and external signers, retain key origin, derivation path and script policy in descriptors—not merely an xpub ([BIP-380](https://bips.dev/380/); [Bitcoin Core descriptor documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)).

**You should see:**
- Legacy comparison: `xpub...` account export and `1...` child P2PKH addresses.
- Rejection of a deliberately mismatched checksum.
- Bawa’s intended BIP-84/`zpub` mapping unchanged.

# Bitcoin — nested SegWit (BIP-49)

Bawa’s current intended account remains `m/84'/0'/0'`, receiving at `m/84'/0'/0'/0/i` (**Bawa code**). That is native SegWit/P2WPKH, with mainnet `zpub` account serialisation ([BIP-84](https://bips.dev/84/); [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)). Keep that default distinct from a BIP-49 compatibility account.

## Path and account boundary

[BIP-49](https://bips.dev/49/) assigns purpose `49'` to **P2SH-P2WPKH**. Bitcoin mainnet account zero receives along:

```text
m/49'/0'/0'
  ↓ receiving branch
m/49'/0'/0'/0
  ↓ address index i
m/49'/0'/0'/0/i
```

`m` denotes the master root; apostrophes mark hardened derivation. Here `49'` selects the purpose, the first `0'` selects Bitcoin mainnet, and the second selects account zero. Branch `0` receives; branch `1` holds change. The branch and address index are non-hardened, and `i` starts at zero. **Authorities:** BIP-32, BIP-44, BIP-49 and SLIP-0044.

## What the address actually encodes

BIP-49 places a version-zero P2WPKH witness programme inside a P2SH wrapper. Let `HASH160(x)` mean `RIPEMD160(SHA256(x))`. Starting with a compressed child public key, construct the address as follows (**BIP-49; BIP-141**):

```text
compressed public key K
  ↓ HASH160
20-byte public-key hash
  ↓ prepend bytes 00 14
redeemScript: 00 14 <public-key-hash>
  ↓ HASH160
20-byte script hash
  ↓ Base58Check with mainnet version 0x05
3... address
```

The redeem script is 22 bytes: `00` represents witness version zero and `14` pushes the 20-byte key hash. The output’s locking script is `OP_HASH160 <script-hash> OP_EQUAL`. The address therefore encodes the hash of the redeem script, **not directly the public-key hash**. **Authorities:** BIP-16, BIP-49 and BIP-141.

For this address, Base58Check takes `0x05 || script-hash`, appends the first four bytes of its double-SHA256 hash, then Base58-encodes the result. Mainnet P2SH addresses begin with `3`, but that prefix alone does not prove BIP-49: other P2SH policies share it. **Authorities:** BIP-13, BIP-32 and BIP-49.

## Why this was a compatibility bridge

The outer P2SH address was already understood by older sending wallets. They could pay a familiar `3...` destination without understanding native SegWit address encoding. The receiving wallet nevertheless needed SegWit-aware derivation and spending support; compatibility for senders did not make every older wallet a valid recovery tool. **Authorities:** BIP-49 and BIP-141.

In a **conceptual spend**, `scriptSig` only pushes the redeem script, while the witness carries the signature and public key. The wrapper adds non-witness bytes compared with an unwrapped witness output. **Authority:** BIP-141.

## What `ypub` means

SLIP-0132 assigns mainnet P2SH-P2WPKH public keys version bytes `0x049d7cb2`, producing the `ypub` prefix. An account `ypub` belongs at `m/49'/0'/0'`; it is not a receiving address.

Its BIP-32 payload is 78 bytes: version, depth, parent fingerprint, child number, chain code and compressed public key. Base58Check supplies the checksum. It does **not** contain the complete derivation origin. **Authorities:** BIP-32 and SLIP-0132.

A watch-only wallet can derive `/0/i` and `/1/i` from that account public key, but cannot sign or derive hardened children. Re-serialising a key under different version bytes changes its representation, not its ancestry. **Authorities:** BIP-32 and SLIP-0132.

## Why a wrong-purpose restore looks empty

The same seed does not make different purposes interchangeable. Hardened `49'` and `84'` select different key subtrees; their address policies also differ. A restore scanning only another purpose can find no matching outputs and display zero. That display does not mean the original outputs moved. **Authorities:** BIP-32 and BIP-49.

Recovery must reproduce the seed and any BIP-39 passphrase, network, purpose, account, receiving/change branches and sufficient address-discovery range. Changing an extended-key prefix cannot repair a wrong-purpose derivation. **Authorities:** BIP-32, BIP-39, BIP-44 and BIP-49.

## Track outputs; retain policy

Do not apply an EVM-style balance-lookup model. Bitcoin tracking sums matching outputs that remain unspent, including change (**BIP-30; BIP-44; BIP-158**):

```text
transaction
  ↓
outputs matching our derived scripts
  ↓
outpoints not subsequently spent
  ↓
tracked unspent value
```

For watch-only, external-signer or multisig workflows, retain origin, path and script policy with descriptors, rather than keeping only an extended key. BIP-49’s single-key receiving policy has this placeholder form (**BIP-380–382**):

```text
sh(wpkh([<MASTER_FINGERPRINT>/49h/0h/0h]<ACCOUNT_XPUB>/0/*))
```

`<ACCOUNT_XPUB>` means the same BIP-49 account public node in standard BIP-32 serialisation—not an account from another purpose. Keep a separate `/1/*` change descriptor and add descriptor checksums. **Authorities:** BIP-32, BIP-44 and BIP-380. Follow [Bitcoin Core’s descriptor documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) for its workflow.

**You should see:**

- [ ] Mainnet `m/49'/0'/0'/0/i` receiving addresses beginning with `3`, and an account `ypub` (**BIP-49; SLIP-0132**).
- [ ] BIP-49’s published testnet vector at `m/49'/1'/0'/0/0` yielding `2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2`, with account prefix `upub` (**BIP-49; SLIP-0132**).
- [ ] A tracked balance based on matching, still-unspent outputs—not merely address history (**BIP-30**).

# Bitcoin: BIP-84

Start with Bitcoin: its account boundary and receiving branch are easy to follow.

**Bawa code — intended format:** use account `m/84'/0'/0'` and receiving template `m/84'/0'/0'/0/i`. Bawa’s intended Bitcoin format is native SegWit P2WPKH.

## Read the path

**Authority: [BIP-84](https://bips.dev/84/), using BIP-32/BIP-44’s hierarchy.**

```text
m
↓ 84' — purpose: native SegWit P2WPKH
m/84'
↓ 0' — coin type: Bitcoin mainnet
m/84'/0'
↓ 0' — account: first account
m/84'/0'/0'
↓ 0 — external/receiving branch
m/84'/0'/0'/0
↓ i — address index
m/84'/0'/0'/0/i
```

Here, `m` denotes the master node. An apostrophe marks hardened derivation: purpose, coin type and account are hardened; branch and address index are not. Hardened children cannot be derived from a parent extended public key. The two non-hardened levels allow receiving addresses to be derived from the account extended public key (BIP-32; BIP-84).

Keep the zeroes separate: they identify the coin, account and receiving branch. Branch `1` is internal/change; `i` starts at `0` and advances for successive addresses. The first receiving path therefore ends `/0/0` (BIP-44, as adopted by BIP-84).

## What “native SegWit” commits us to

**Authority: BIP-84.** P2WPKH means *pay to witness public key hash*. Its output script is `OP_0 <20-byte-key-hash>`: witness version `0` followed by the HASH160 of a compressed public key.

“Native” means this witness program sits directly in the output, without a P2SH wrapper. When spent, the signature and public key belong in the witness; `scriptSig` is empty. BIP-84 encodes these addresses using Bech32; Bitcoin mainnet addresses begin `bc1q`.

**Authority: [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md).** The corresponding mainnet extended account public-key serialisation uses `zpub`. That is an extended public key, not a receiving address.

For Bawa, keep the path and output construction together: the intended account selects BIP-84’s derivation family, and its receiving keys become native P2WPKH outputs. Changing the purpose changes the derived keys; merely changing a displayed prefix does not implement this format (Bawa code; BIP-32; BIP-84).

**You should see:** first receiving path `m/84'/0'/0'/0/0`, mainnet address prefix `bc1q`, and `zpub` for SLIP-0132 account public-key serialisation (Bawa code; BIP-84; SLIP-0132).

# Bitcoin: native SegWit

Start with Bitcoin. **Bawa code** implements this format only for BTC: `derive.js btc` uses the following account and receiving path.

```text
m/84'/0'/0'        account
    ↓
m/84'/0'/0'/0     receiving branch
    ↓
m/84'/0'/0'/0/i   receiving key
```

Under [BIP-84](https://bips.dev/84/) and [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md), `84'` selects native SegWit P2WPKH, the first `0'` selects Bitcoin mainnet, and the second selects account zero. Apostrophes mark hardened [BIP-32](https://bips.dev/32/) derivation; `/0/i` selects the non-hardened external/receiving branch and address index (BIP-84).

## Receiving addresses: `bc1q…`

BIP-84 specifies witness version `0` and a 20-byte public-key hash. With BIP-32’s compressed public key, this is `HASH160(pubkey)`, meaning `RIPEMD160(SHA256(pubkey))`; the output script is `0014<hash>` ([BIP-141](https://bips.dev/141/)).

[BIP-173](https://bips.dev/173/) encodes the witness version and hash as Bech32, not the complete script: `bc` identifies mainnet, `1` separates prefix and data, and `q` represents version zero. These P2WPKH addresses have 42 characters, including a six-character checksum. Use lower case; mixed case is invalid. Validate the checksum and 20-byte program too: `bc1q` alone is not P2WPKH-specific (BIP-141/173). Version zero uses Bech32, not Bech32m ([BIP-350](https://bips.dev/350/)).

## Account serialisation: `zpub…`

SLIP-0132 assigns mainnet P2WPKH public version `0x04b24746`, yielding `zpub…` through Base58Check. At the account path, the BIP-32 payload carries the public key, chain code, depth, parent fingerprint and child number—not a payment address. A watch-only wallet can derive `/0/i` from it but cannot sign (BIP-32).

A `zpub` does not encode the complete origin path; retain `m/84'/0'/0'` separately (BIP-32). Changing extended-key format requires replacing version bytes and recalculating the Base58Check checksum, not editing the printed prefix; it does not change the derivation path (BIP-32; SLIP-0132).

For testnet, the corresponding forms are `tb1q…` and `vpub…` (BIP-173; SLIP-0132).

**You should see:** `derive.js btc` using `m/84'/0'/0'/0/i`, `bc1q…` mainnet receiving addresses, and `zpub…` when serialising the account as specified above (Bawa code; BIP-84; SLIP-0132).

# Bitcoin

Bitcoin makes the HD-wallet model concrete. Bawa’s current intended layout (Bawa code) uses account `m/84'/0'/0'` and receiving paths `m/84'/0'/0'/0/i`.

These select native SegWit P2WPKH ([BIP-84](https://bips.dev/84/)); the account public-key serialisation is `zpub` ([SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)).

### Count unspent outputs

A Bitcoin wallet balance sums its currently unspent transaction outputs (UTXOs), rather than reading an on-chain integer stored against an address. Do not apply the EVM account-balance mental model here (protocol authority: [BIP-30](https://bips.dev/30/) and [BIP-174](https://bips.dev/174/)).

A transaction creates numbered outputs, each containing a value in satoshis and a locking script stating its spending conditions. The creating transaction ID and zero-based output index, `(txid, vout)`, identify one output: its **outpoint**. A UTXO is an output not yet consumed by a spending transaction (BIP-174).

A valid spending input references that outpoint and fulfils its spending conditions. It consumes the **whole output**; it cannot reduce the value in place. The spent output remains part of transaction history, but leaves the unspent set (BIPs 30/174).

Track outputs controlled by our wallet, exclude spent ones, and add each remaining outpoint’s value once. Each represents a distinct amount still available as an input. Their sum therefore gives the wallet’s gross input value—not its lifetime receipts (BIPs 30/174).

```text
transactions
  ↓
created outputs
  ↓
outputs controlled by our wallet
  ↓
outputs still unspent
  ↓
sum of values available as inputs
```

[Esplora’s API](https://github.com/Blockstream/esplora/blob/master/API.md) exposes UTXO lists and per-output spending status. [ElectrumX’s protocol documentation](https://electrumx.readthedocs.io/en/latest/protocol-methods.html) describes script-hash UTXO lists: concrete inventories for this model.

**Conceptual testnet example:** two wallet UTXOs holding 40,000 and 25,000 sats give 65,000 sats. Spending the 40,000-sat output could create a 30,000-sat payment and 9,000-sat change back to us. The 1,000-sat input/output difference is the fee, not another output. Change is a new output; the unselected 25,000-sat output remains untouched (BIP-174 accounting).

UTXO totals are before fees; spending conditions must still be satisfied before treating value as immediately spendable (BIP-174).

**You should see:** two wallet UTXOs totalling **34,000 sats**: the untouched 25,000 and new 9,000. The original 40,000-sat outpoint is spent.

Bitcoin is a straightforward starting point for HD tracking.

**Bawa code:** the intended account is `m/84'/0'/0'`; receiving addresses use `m/84'/0'/0'/0/i`. [BIP-84](https://bips.dev/84/) specifies native SegWit P2WPKH; [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) specifies the corresponding mainnet `zpub` serialisation.

### Identify owned outputs

Derive receiving `/0/i` and change `/1/i` scripts from the account public key ([BIP-32](https://bips.dev/32/), BIP-84 and [BIP-44](https://bips.dev/44/)). Keep seeds and private keys away from indexers.

Persist known indices and scan ahead. BIP-44’s discovery limit is 20 consecutive unused receiving addresses; “unused” means no transaction history, not zero balance. Extend discovery whenever history appears, and never stop before checking your stored address range.

For BIP-84’s P2WPKH outputs, compare each locking script (`scriptPubKey`) with our derived script set. A transaction appearing in our history does not make every output ours: it may pay somebody else too.

```text
receiving and change scripts
  ↓
indexed history and UTXOs
  ↓
matching (txid, vout) outpoints
  ↓
reconciled unspent set
  ↓
policy-eligible value
```

### Query an index

**[Esplora API authority](https://github.com/Blockstream/esplora):** use its indexed REST API, hosted or self-hosted. Fetch `/address/:address/txs`, paginate confirmed history through `/address/:address/txs/chain/:last_seen_txid`, and query `/address/:address/utxo`. `/tx/:txid` supplies output scripts and values; `/tx/:txid/outspends` supplies spending status. Mempool and block endpoints provide pending-transaction and chain-tip information.

**[ElectrumX authority](https://github.com/spesmilo/electrumx):** run the indexer against your Bitcoin full node. Query `blockchain.scripthash.get_history` and `blockchain.scripthash.listunspent`. The lookup key is SHA-256 of the locking-script bytes, byte-reversed and hex-encoded—not a hash of address text. Fetch transactions with `blockchain.transaction.get` when auditing outputs. Use `blockchain.scripthash.subscribe` notifications to trigger fresh queries.

### Reconcile, then total

Using either index’s documented responses, key outputs by `(txid, vout)`: transaction ID and output index. Inputs consume referenced outpoints; change creates new outputs. Sum each owned, currently unspent outpoint once, in satoshis—not every historical receipt.

Record the index tip. Re-query after notifications or polling, reconciling mempool replacements and reorganisations. Separate confirmed and pending amounts; apply confirmation and maturity requirements before calling funds spendable.

**Bawa code’s UTXO/account distinction:** an EVM native balance is account state; Bitcoin wallet value requires aggregation across owned, unspent outputs.

You should see: receiving and change outputs counted once, spent outpoints excluded, and confirmed/pending totals clearly separated.

# Bitcoin: Taproot (BIP-86)

Bitcoin is a straightforward place to follow HD derivation. Bawa’s current intended account remains `m/84'/0'/0'`, receiving at `m/84'/0'/0'/0/i` (Bawa code). That is native SegWit P2WPKH ([BIP-84](https://bips.dev/84/)); [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) assigns that format the `zpub` extended-public-key prefix. Keep Taproot separate.

## Derivation

[BIP-86](https://bips.dev/86/) specifies single-key Taproot/P2TR without a script tree. For Bitcoin mainnet account zero:

```text
m
  -> m/86'                  Taproot purpose
  -> m/86'/0'               Bitcoin mainnet
  -> m/86'/0'/0'            account zero
  -> m/86'/0'/0'/0          receiving branch
  -> m/86'/0'/0'/0/i        address index
```

Under BIP-86’s [BIP-44](https://bips.dev/44/) hierarchy, apostrophes mark hardened derivation. The receiving branch and `i` are non-hardened; indices start at zero. Internal/change addresses use branch `1`.

## From key to address

Do not encode the derived public key directly. BIP-86 takes its x-coordinate and lifts it to the even-y internal point `P` ([BIP-340](https://bips.dev/340/)).

Without a script tree, compute `t = int(tagged_hash("TapTweak", x(P)))`, then `Q = P + tG`. Here `G` is secp256k1’s generator, and x-coordinates use 32-byte, big-endian encodings ([BIP-341](https://bips.dev/341/); BIP-340; BIP-86).

```text
BIP-32 child public key
  -> internal point P
  -> tweaked output point Q
  -> 32-byte x(Q), witness version 1
  -> bc1p... encoded with Bech32m
```

The scriptPubKey is `OP_1 PUSH32 <x(Q)>`: hex `5120` followed by the output key’s 32 bytes (BIP-86). The address contains `x(Q)`, not the untweaked `x(P)`.

Mainnet uses `bc`; witness version `1` supplies the `p` after separator `1`. The checksum must be **Bech32m**, not original Bech32 ([BIP-350](https://bips.dev/350/); BIP-86).

## Extended keys

SLIP-0132 assigns **no standardised Taproot-specific extended-key prefix**. **Do not reuse a `zpub` for a Taproot account:** it denotes P2WPKH.

BIP-86’s published vectors use ordinary [BIP-32](https://bips.dev/32/) `xpub` serialisation. Retain the BIP-86 origin path and P2TR policy alongside it: `xpub` alone does not identify the address format. Changing version bytes cannot derive the separate BIP-86 account (BIP-32; BIP-86).

**You should see:** for a BIP-86 derivation, a Bech32m-valid mainnet `bc1p...` address decoding to witness version `1` and a 32-byte output key, with no Taproot `zpub` (BIP-86; BIP-350; SLIP-0132).

### Bitcoin descriptors

For watch-only or multisig work, retain the descriptor, not merely an xpub. Bitcoin Core’s [descriptor documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md) describes the model standardised in BIPs 380–383.

**BIP 32:** an xpub contains a public key, chain code, depth, immediate-parent fingerprint and child number. It has no field for the complete origin path, which descendants to monitor, or the intended script policy.

Public-only testnet template, with placeholders (BIPs 84, 380, 382; SLIP-44):

```text
wpkh([<MASTER_FPR>/84h/1h/0h]<ACCOUNT_TPUB>/0/*)
```

- **Origin — BIP 380:** the optional bracketed field records a starting-key fingerprint and the path to the supplied key. Here, that means the four-byte master fingerprint and account path. The fingerprint is not guaranteed unique (BIP 32). This provenance helps an external signer locate the relevant key (BIP 174); it does not instruct the watch-only wallet to repeat that derivation.

- **Descendant path — BIPs 32, 84, 380:** `/0/*` derives receive-branch children from the supplied tpub, with `*` ranging over non-hardened indices. Together, origin and suffix describe `m/84h/1h/0h/0/i`. A separate `/1/*` descriptor covers change. Hardened `h` steps in the origin have already happened; public-only derivation cannot perform a hardened step in the suffix.

- **Script policy — BIPs 381–383:** `wpkh(...)` selects native SegWit P2WPKH; `pkh(...)` selects legacy P2PKH; `sh(wpkh(...))` wraps SegWit in P2SH. The same child public key therefore produces different scripts and addresses. Multisig policy also fixes the threshold, cosigner-key expressions and any wrapper: `multi` preserves supplied key order; `sortedmulti` sorts derived public keys lexicographically.

Public-only recognition follows this route (BIPs 32, 380–383):

```text
account tpub
    ↓ non-hardened branch/index
child public keys
    ↓ script policy
expected scriptPubKeys
```

A watch-only wallet matches transaction outputs against these scripts without holding secrets. Origin metadata does not change the generated addresses: the supplied keys, suffixes and policy determine them. Wrong policy, omitted change or an insufficient monitored range can leave outputs unrecognised (BIPs 32, 380–383).

**You should see:** receive and change addresses recognised within the monitored range, with no local signing capability (BIP 32).

For Taproot watch-only, multisig and external signing, retain the account’s origin, derivation and spending policy together—not merely its extended public key ([BIP380](https://bips.dev/380/); [Bitcoin Core documentation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)).

**Why `tr()`, not `zpub`?** [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) assigns `zpub` to mainnet P2WPKH, not Taproot. [BIP32](https://bips.dev/32/) extended keys lack the complete origin and script policy; changing their prefix cannot add either.

[BIP86](https://bips.dev/86/) defines single-key Taproot derivation at `m/86'/coin_type'/account'/change/address_index`. The derived public key supplies the **x-only internal key**; Taproot tweaks this into the output key even without scripts. [BIP386](https://bips.dev/386/)’s `tr(KEY)` expresses that no-script-tree output.

Testnet receive template (BIPs44/86/386; placeholders only):

```text
<master fingerprint and account tpub>
  ↓
tr([<FPR>/86h/1h/0h]<ACCOUNT_TPUB>/0/*)#<CHECKSUM>
  ↓
<testnet P2TR receive addresses>
```

The bracketed origin records the master fingerprint and account path (BIP380). `/0/*` selects receive addresses; retain `/1/*` separately for change (BIP86). Generate the checksum using Core’s `getdescriptorinfo` (BIP380; Core documentation).

**Multisig needs additional policy; BIP86 does not define it.** `tr(INTERNAL,TREE)` commits to a script tree whose leaves are alternative spending routes (BIPs341/386). A conceptual, testnet-only policy is `tr(<INTERNAL_KEY>,multi_a(2,<A>,<B>,<C>))`: a two-of-three tapscript leaf using `OP_CHECKSIGADD`, rather than legacy `multi()` ([BIP342](https://bips.dev/342/); Core documentation). Retain each cosigner’s origin and derivation for key discovery; preserve threshold, key order and tree structure to reproduce outputs (BIPs380/386).

**Do not overlook the key path.** Whoever controls the internal-key secret can bypass that leaf. Use joint key control, or [BIP341](https://bips.dev/341/)’s NUMS construction if no key-path spend is intended. MuSig2 key-path signing uses a separate, n-of-n protocol—not this two-of-three leaf ([BIP327](https://bips.dev/327/)).

Public descriptors support monitoring without signing secrets (BIP380). For external signing, [BIP371](https://bips.dev/371/) PSBT fields convey Taproot derivations, leaf scripts and control blocks as needed. Use compatible signers and verify the agreed policy on them; storing a descriptor does not establish signing support.

**You should see:**
- [ ] Matching testnet receive/change addresses from coordinator and signer, with agreement on both the threshold leaf and key-path policy.

### Bitcoin formats: mainnet beside test networks

Bitcoin maps to coin type `0` in Bawa code. Coin type does **not** select the address format; keep Bawa’s intended choice explicit:

```text
Bawa’s intended Bitcoin format
↓
BIP-84
↓
native SegWit
↓
P2WPKH
```

Choose legacy, nested SegWit or Taproot for an explicit format requirement. Bawa documents no wallet-compatibility guarantees, so check the target wallet’s format **and network** documentation.

#### Paths and prefixes

[SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns Bitcoin `0` and shared testnet use `1`: mainnet paths use `0'`; testnet, signet and regtest paths use `1'`.

Under [BIP-44](https://bips.dev/44/), account-zero paths are `m/purpose'/0'/0'` on mainnet and `m/purpose'/1'/0'` on test networks. Apostrophes mark hardened levels. Appending `/0/i` selects external receiving branch `0` and non-hardened address index `i`.

The format authorities are linked below; all address strings are prefix placeholders.

| Format / authority | Mainnet receiving path; prefix | Testnet/signet receiving path; prefix |
|---|---|---|
| Legacy P2PKH — BIP-44 | `m/44'/0'/0'/0/i`; `1...` | `m/44'/1'/0'/0/i`; `m...` or `n...` |
| Nested SegWit P2SH-P2WPKH — [BIP-49](https://bips.dev/49/) | `m/49'/0'/0'/0/i`; `3...` | `m/49'/1'/0'/0/i`; `2...` |
| Native SegWit P2WPKH — [BIP-84](https://bips.dev/84/) | `m/84'/0'/0'/0/i`; `bc1q...` | `m/84'/1'/0'/0/i`; `tb1q...` |
| Taproot P2TR — [BIP-86](https://bips.dev/86/) | `m/86'/0'/0'/0/i`; `bc1p...` | `m/86'/1'/0'/0/i`; `tb1p...` |

Signet shares testnet address encoding ([BIP-325](https://bips.dev/325/)). Regtest uses the same coin-`1` paths, but its human-readable prefix is `bcrt` ([SLIP-0173](https://github.com/satoshilabs/slips/blob/master/slip-0173.md)): expect `bcrt1q...` for BIP-84 and `bcrt1p...` for BIP-86. Taproot uses Bech32m ([BIP-350](https://bips.dev/350/)). Configure network encoding separately from derivation; editing an address prefix is not conversion.

For native-SegWit account serialisation, [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md) specifies `zpub...` on mainnet (`m/84'/0'/0'`) and `vpub...` on test networks (`m/84'/1'/0'`). These are extended public-key prefixes, not address prefixes.

**You should see:** testnet BIP-84 at `m/84'/1'/0'/0/i` producing `tb1q...`, not `bc1q...`; regtest Taproot producing `bcrt1p...`, not `tb1p...`.

### Bitcoin formats: match testnet prefixes to purpose

**Bawa code:** Bitcoin maps to coin type `0`; that does not choose among the four address formats. Require an explicit format. Bawa’s intended mainnet choice is BIP-84, native SegWit/P2WPKH.

Mainnet baseline — Bawa code and [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md):

```text
BIP-84: native SegWit / P2WPKH
↓
account:   m/84'/0'/0'
receiving: m/84'/0'/0'/0/i
↓
zpub — public version 0x04b24746
```

Keep Bawa’s documented `zpub` scoped to this BIP-84 account. For other formats, check the relevant BIP, SLIP-0132 and the target wallet’s documentation rather than assuming the same serialisation.

[SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns coin type `1` to testnet across coins, versus Bitcoin mainnet’s `0`. [BIP-44](https://bips.dev/44/) defines `m/purpose'/coin_type'/account'/change/address_index`: apostrophes mark hardened derivation. Below, `0'` selects the first account; append `/0/i` for receiving address index `i`, with both suffix components non-hardened.

SLIP-0132 registers these testnet extended-public-key versions and purpose/script pairings. These prefixes identify serialised extended keys, not receiving addresses:

```text
BIP-44 account: m/44'/1'/0'
↓
P2PKH — legacy
↓
tpub — public version 0x043587cf
```

```text
BIP-49 account: m/49'/1'/0'
↓
P2WPKH-in-P2SH — wrapped SegWit
↓
upub — public version 0x044a5262
```

```text
BIP-84 account: m/84'/1'/0'
↓
P2WPKH — native SegWit
↓
vpub — public version 0x045f1cf6
```

Under SLIP-0132, the four-byte version fields produce the displayed Base58Check prefixes. Treat them as network/script signals, not letters to edit. Re-encoding with different version bytes leaves the public key and chain code unchanged: changing a mainnet `zpub` serialisation to `vpub` does not derive the coin-type-`1'` testnet account (BIP-44; SLIP-0044; SLIP-0132).

One qualification matters: SLIP-0132 also lists P2SH under `tpub`. Here, `tpub` matches BIP-44/P2PKH, but its prefix alone cannot prove the derivation purpose. Check path and script together.

**You should see:** testnet BIP-44 paired with `tpub`, BIP-49 with `upub`, and BIP-84 with `vpub`; the mainnet BIP-84 account remains `zpub`, matching SLIP-0132.

### Bitcoin: validate network and format

**Bawa code:** Bitcoin maps to coin type `0`, not an address format. Bawa’s derive tools hard-code mainnet `0'` paths. Do not expect testnet addresses from them.

The same mnemonic and passphrase produce the same seed (BIP-39). Standards-based mainnet/testnet derivation nevertheless produces different addresses: the paths use `0'`/`1'` respectively ([BIP-44](https://bips.dev/44/), [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)), and network encodings differ. Testnet coins have no real value as mainnet BTC; treat them as testing tokens, consistent with BIP-94’s rationale.

#### Validation checklist

1. **Prefix matches purpose.** Compare these reference patterns (BIP-44/49/84/86; [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)). A prefix cannot prove the derivation path or wallet compatibility.

| Purpose | Address: mainnet / testnet | Account: mainnet / testnet |
|---|---|---|
| 44, legacy | `1…` / `m…` or `n…` | `xpub` / `tpub` |
| 49, nested SegWit | `3…` / `2…` | `ypub` / `upub` |
| 84, native SegWit | `bc1q…` / `tb1q…` | `zpub` / `vpub` |
| 86, Taproot | `bc1p…` / `tb1p…` | `xpub` / `tpub` † |

2. **Checksum valid.** Verify Base58Check for legacy/nested addresses and extended keys (BIP-13/32), Bech32 for witness v0 (BIP-173), and Bech32m for v1 (BIP-350). Validate witness version and length too. A valid checksum can still belong to the wrong network.

3. **Account serialisation matches purpose.** For BIP-84, `zpub`/`vpub` describe account serialisation, not address prefixes (SLIP-0132). † BIP-86’s vectors use `xpub`; `tpub` is the BIP-32 testnet counterpart. SLIP-0132 reserves no Taproot-specific version: check the path and wallet policy too.

4. **Path coin type matches network.** Compare these BIP-84 accounts and receiving templates, using BIP-44/SLIP-0044 coin types. The testnet stack is a standards reference, not Bawa testnet support.

```text
mainnet account: m/84'/0'/0'
  ↓
receiving: m/84'/0'/0'/0/i
```

```text
testnet account: m/84'/1'/0'
  ↓
receiving: m/84'/1'/0'/0/i
```

**Bawa code:** BIP-44/49/86 paths are references, not Bawa defaults. Do not assume replacing `84` switches encoders or serialisation. Bawa documents neither network/testnet configuration nor compatibility guarantees, fee/migration advice or executable derivation/signing procedures. Check network specifications, target-wallet and implementation documentation, and current fees; verify behaviour against published test vectors.

**You should see:** four checks agreeing on one network and format—not testnet output from Bawa’s mainnet tools.

# EVM: reuse the account, not the network

Keep network selection separate from derivation. With the same seed and complete path, Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Smart Chain and Avalanche C‑Chain can share an Ethereum-style address. They remain distinct networks, and wallet defaults can differ. **Authority: [BIP‑32](https://bips.dev/32/) and [Wallet Core docs](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage).**

### Read the whole path

The conventional `m/44'/60'/0'/0/i` path follows [BIP‑44](https://bips.dev/44/):

- `m`: master node.
- `44'`: BIP‑44 purpose.
- `60'`: Ethereum’s coin type, assigned by [SLIP‑0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md), **not a network chain ID**.
- `0'`: first account.
- `0`: external branch.
- `i`: zero-based address index, below `2³¹`.

Apostrophes mark hardened derivation; the final two levels are unhardened (BIP‑32/BIP‑44). Change the account component to select another account; change `i` to select another address.

[BIP‑39](https://bips.dev/39/) defines mnemonic-to-seed conversion: preserve the optional passphrase too. For tooling, [viem’s documentation](https://viem.sh/docs/accounts/local/mnemonicToAccount) describes `mnemonicToAccount`, using BIP‑39 and `@scure/bip32`; [ethers](https://docs.ethers.org/) also provides HD wallets. Specify the path rather than assuming defaults.

### Derive the address bytes

**Authority: BIP‑39/BIP‑32 for seed/key derivation; Wallet Core’s Ethereum documentation for address construction.**

```text
<mnemonic> + <BIP-39 passphrase>
  ↓ BIP-39
seed
  ↓ BIP-32: m/44'/60'/0'/0/i
secp256k1 private key
  ↓ public-key derivation
65-byte uncompressed public key
  ↓ remove the leading 0x04 byte
X || Y: two 32-byte big-endian coordinates
  ↓ Keccak-256
32-byte digest
  ↓ retain the last 20 bytes
EVM address
```

Use **Keccak‑256**, not SHA3‑256. Hash neither the compressed public key nor the uncompressed key’s prefix byte.

### Apply the mixed-case checksum

Under [EIP‑55](https://eips.ethereum.org/EIPS/eip-55), render the address as 40 lowercase hex digits, preserving leading zeroes and excluding `0x`. Keccak‑256 hash that **ASCII text**, not the raw address bytes, and express the hash in hex.

For each address letter `a`–`f`, uppercase it if the hash hex digit at the same position is `8`–`f`; otherwise leave it lowercase. Numeric digits remain unchanged. Add `0x` afterwards.

EIP‑55 changes presentation, not address bytes, and carries no network identifier.

**You should see:** unchanged address bytes when only the compatible network changes. Lowercasing then checksumming EIP‑55’s published test vector restores `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`.

## Coin type `60` is not a chain ID

[BIP‑44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) defines the hardened `coin_type'` path component; [SLIP‑44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) registers `60` for Ether. This selects a **derivation namespace**, not a network or transaction-signing domain.

Wallet Core’s [usage documentation](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) and [chain registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json) provide the implementation reference:

```text
m/44'/60'/0'/0/0
    ↓
Ethereum-style keypair
    ↓
0x<20-byte-address>
```

With the same key and Ethereum addressing rule, the same 20-byte externally owned account address is usable across compatible EVM networks. Address reuse does not make them one ledger.

Wallet Core’s registry records these **mainnet chain IDs**; [EIP‑155](https://eips.ethereum.org/EIPS/eip-155) defines their transaction replay-protection role:

| Network | Chain ID |
|---|---:|
| Ethereum | 1 |
| Optimism | 10 |
| BNB Smart Chain | 56 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Avalanche C-Chain | 43114 |
| Base | 8453 |

**Do not replace `60'` with a chain ID, or populate a transaction’s chain ID from its derivation path.**

EIP‑155 appends `(chainId, 0, 0)` to the six unsigned legacy transaction fields for signing; `v` encodes that ID. This prevents replay on enforcing chains with different IDs, not chains reusing an ID. Unprotected legacy signatures lack this safeguard.

[EIP‑1559](https://eips.ethereum.org/EIPS/eip-1559) includes `chain_id` in its signed typed-transaction payload and specifies base-fee/priority-fee handling. Check each network’s fee support rather than assuming identical behaviour.

Wallet Core’s documentation describes offline derivation/signing; [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/) defines network-state queries. Keep balances, native gas assets, RPC endpoints, explorers, contract/token addresses, fees, finality, supported RPC methods and transaction rules network-specific. Matching addresses promise neither matching funds nor matching contract code.

A wrong-network transfer can leave funds inaccessible or a deposit permanently uncredited. Replay protection cannot rescue a transaction correctly signed for the **wrong intended network**.

For a conceptual testnet transfer, decode the RPC’s hexadecimal `eth_chainId` and compare it with the selected testnet’s configured signing ID—not the mainnet table or `60`. Confirm recipient network support before signing.

**You should see:** the same placeholder address, separate per-network state, and the selected testnet’s chain ID matching both RPC and signer.

# EVM chains

### Keep ENS identifiers out of derivation

Bawa uses coin type `60` for EVM accounts. Adding another EVM network must neither create a new HD root nor replace that coin-type component (**authority: Bawa code**).

[SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns `60` to Ethereum. [BIP-44](https://bips.dev/44/) requires the coin-type component to be hardened, written `60'` in the derivation path.

[ENSIP-11](https://docs.ens.domains/ensip/11/) defines `0x80000000 | chainId` for EVM-chain address-record coin types in ENS; Ethereum mainnet retains `60`. **That mapping is for ENS address resolution, not Bawa wallet derivation.** Its high bit is not an instruction to alter Bawa’s HD path.

Do not substitute either the ENS-derived identifier or the chain ID for `60'`. Changing the coin-type component selects a different derivation branch; it does not retarget the existing account (**authorities: BIP-44; Bawa code**).

```text
Bawa HD root
  ↓ derivation with coin type 60'
One EVM account
  ↓ network runtime selection
Selected EVM network
```

### Per-network runtime checklist

Bawa code separates account derivation from network selection. [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/) defines the standard node interface for querying chain state and submitting transactions, including the calls below.

Check these runtime settings independently for every network:

- **Chain ID:** pin the expected value, compare it with RPC `eth_chainId`, and use the matching value when constructing transactions.
- **RPC endpoint:** select the intended network’s URL. Verify chain identity and required method support rather than trusting the endpoint’s name.
- **Block explorer:** configure network-specific address and transaction URL templates.
- **Native asset:** configure its name, symbol and decimals for balance and fee presentation; do not inherit another network’s currency metadata.
- **Fee rules:** select supported transaction types and pricing: legacy `gasPrice` or, where supported, EIP-1559 fee caps and priority fees. Estimate gas against the selected RPC with `eth_estimateGas`; include any network-specific additional charges rather than reusing another network’s fee assumptions.

Keep smart-contract and token-contract addresses network-scoped too: account reuse does not establish deployment equivalence (**authority: Bawa code’s runtime boundary**).

**You should see:** the same derived account after a network switch, with a verified chain ID and network-correct RPC, explorer, native-asset metadata and fee configuration.

# TRON

## 1. Select the child key deliberately

**Authority:** [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) and [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) define derivation; [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) registers coin types; Bawa code supplies the watch-only account-root policy.

A common TRON path is `m/44'/195'/0'/0/i`. Here, `44'` selects the BIP-44 structure, `195'` selects TRON, and `0'` selects account zero. Apostrophes mark hardened derivation. The remaining `0` selects the external branch; `i` is its address index.

Under this policy, Bawa receives the account-level public root and derives beneath it:

```text
account public root at m/44'/195'/0'
  ↓ derive external branch 0
public branch at m/44'/195'/0'/0
  ↓ derive address index i
public key at m/44'/195'/0'/0/i
```

Both remaining steps are unhardened, so public derivation needs no private key.

Keep **same key** separate from **same seed**. Ethereum’s registered coin type is `60`; its usual BIP-44 route therefore selects a different branch. A shared seed alone does not establish that the resulting keys match.

**You should see:** watch-only derivation of `0/i` beneath the intended TRON account public root.

## 2. Calculate the shared 20-byte value

**Authority:** BIP-32 for compressed public-key serialisation; [TRON account rules](https://developers.tron.network/docs/account) for the secp256k1 foundation and Ethereum-related address calculation.

For this comparison, hold the secp256k1 public point fixed. Both address calculations begin with that same point—not merely keys produced from similarly shaped paths.

Expand a compressed public key before hashing. Its uncompressed representation contains a one-byte `0x04` format marker followed by two fixed-width, 32-byte coordinates. Hash the coordinates only:

```text
0x04 || X || Y — 65 bytes
  ↓ remove the single format byte 0x04
X || Y — 64 bytes
  ↓ Keccak-256
digest — 32 bytes
  ↓ retain the final 20 bytes
H — 20 bytes
```

Here, `||` means byte concatenation. Preserve each coordinate’s leading zero bytes. Do not hash the compressed point, the `0x04` marker, or printable hexadecimal text. Use Keccak-256, not NIST SHA3-256.

`H` is also the Ethereum address payload for this identical public key.

**You should see:** exactly 20 bytes in `H`, matching the Ethereum address bytes for the same key.

## 3. Add TRON’s address encoding

**Authority:** [TRON account rules](https://developers.tron.network/docs/account) specify the prefix, hexadecimal representation and Base58Check format.

TRON places the byte `0x41` before `H`. Base58Check then adds a checksum and encodes the complete result:

```text
H — 20 bytes
  ↓ prepend byte 0x41
P = 0x41 || H — 21 bytes
  ↓ append the first 4 bytes of SHA-256(SHA-256(P))
P || checksum — 25 bytes
  ↓ Base58-encode
TRON address — 34 characters, beginning with T
```

The checksum uses double SHA-256; it does not reuse the Keccak digest.

TRON’s **hex form** represents `P`, without the checksum: `41` followed by 40 hexadecimal digits, totalling **42 characters**, excluding any optional `0x` notation marker.

Removing the initial `41` from that hex form recovers `H`. Ethereum normally displays `H` as `0x` followed by 40 hex digits. Notice the distinction: TRON’s `41` represents an actual byte; Ethereum’s `0x` is a notation marker. Never try to obtain `H` by trimming characters from the Base58 address.

**You should see:** a valid 34-character `T…` address whose decoded payload starts with `0x41`; its remaining 20 bytes match `H`.

## 4. Keep the chain boundary intact

**Authority:** [Wallet Core docs](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) provide coin-specific address and signing APIs; TRON account rules define its address representation.

We share a public-key calculation, not an interchangeable address format. Removing `41` demonstrates the relationship; it does not switch networks or make Ethereum transactions and RPC calls suitable for TRON.

For a dedicated TRON application, prefer a maintained TRON SDK or Wallet Core’s TRON functionality for address handling. Keep transaction construction and RPC integration TRON-specific rather than adapting Ethereum string handling.

**You should see:** distinct address representations for the same key, with TRON-aware validation and network handling.

## Bawa’s watch-only boundary

In Bawa code, `derive.js` and `derive_daemon.js` implement `trx` using `m/44'/195'/0'/0/i`. Both validate inputs, accept integer indices from `0` to `2147483647` inclusive, and reject private extended keys.

Supply the **account-level extended public root** at `m/44'/195'/0'`. Bawa derives the external branch `/0`, then the requested address index `/i`; it does not need private material for this watch-only flow.

The path structure comes from [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), while [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns coin type `195` to TRON. Under [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), public derivation supports the non-hardened `/0/i` steps, but cannot recreate the hardened ancestors marked with apostrophes.

```text
account-level extended public root
m/44'/195'/0'
    ↓ derive non-hardened child 0
external-branch public root
m/44'/195'/0'/0
    ↓ derive non-hardened child i
address public key
m/44'/195'/0'/0/i
    ↓ apply TRON address encoding
<TRON-address-placeholder>
```

For Bawa’s derived addresses, use this validation checklist. Bawa code is the implementation authority; TRON’s [account documentation](https://developers.tron.network/docs/account) defines the address encoding:

- The Base58Check representation starts with `T`.
- It contains exactly **34 characters**.
- Its **Base58Check checksum is valid**.
- The decoded address payload, written as hexadecimal, starts with **`41`**.

Do not stop at the prefix and length: a damaged address can satisfy both while failing its checksum.

**You should see:** valid indices producing addresses that pass all four checks, with private extended keys and out-of-range indices rejected.

## Catch the cross-network paste

TRON’s [wallet developer guide](https://developers.tron.network/docs/wallet-developer-guide) describes its Ethereum-like secp256k1 foundation. That shared curve does **not** make the address formats interchangeable. [Wallet Core’s documentation](https://developer.trustwallet.com/developer/wallet-core/integration-guide/wallet-core-usage) likewise exposes address handling through coin-specific interfaces: select TRON, not Ethereum.

TRON’s account documentation specifies a hexadecimal address containing the `41` prefix followed by a 20-byte address payload. Its familiar `T` representation is Base58Check-encoded. Keep those representations distinct from an Ethereum/EVM hexadecimal address:

- **Ethereum `0x` address pasted into a TRON field:** a normal EVM address is a 20-byte hexadecimal value, usually displayed with `0x`. It lacks TRON’s `41` prefix and Base58Check packaging, so it fails a TRON Base58Check field’s validation. Where a TRON API requests hexadecimal instead, it still needs the TRON address form.
- **TRON `T` address pasted into an EVM field:** the supplied string is Base58Check text, not the hexadecimal 20-byte address expected by the EVM address interface. It therefore fails that format check.

These failures follow from TRON’s documented encoding and Wallet Core’s coin-specific address model. Replacing `0x` with `T` is not an encoding conversion.

Keep the network boundary as well. Bawa’s watch-only derivation does not replace TRON-specific transaction construction or RPC handling; those follow TRON’s wallet developer guide, not Ethereum conventions.

For a dedicated TRON application, choose a maintained TRON SDK or the relevant Trust Wallet Core facilities. Let maintained TRON-aware code construct and validate addresses rather than adapting Ethereum address routines.

**You should see:** cross-format pastes rejected before use, with TRON address handling delegated to a TRON-aware library.

# TON

## 1. Keep Bawa’s support boundary explicit

TON is generation-supported only in Bawa — one deposit address per wallet, no xpub exported, no TON xpub watch-only flow, because derive.js and derive_daemon.js support btc, eth and trx only.

**Authority: Bawa code.** `generate.js` produces and validates the TON address. The chain lists in `derive.js` and `derive_daemon.js` contain only `btc`, `eth` and `trx`. `make_wallet.py` maps the generated TON address to an environment variable, not to a TON extended public key.

“One deposit address per wallet” describes Bawa’s output. It is not a TON protocol rule that a mnemonic can identify only one account. Keep those two claims separate: generation support does not imply support in Bawa’s public-derivation tools.

**You should see:** a TON address in the generated wallet record, but no `ton` entry in either derivation tool’s supported-chain list.

## 2. Why the mnemonic does not fix one TON address

[SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns coin type **607** to TON. That allocation identifies the coin; it does not specify a wallet contract, choose a subwallet or promise an xpub interface.

[TON TEP-3: Guideline for TON Wallets](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md) is the authority for TON’s wallet mnemonic schemes, Ed25519 keys, wallet smart contracts and subwallet/wallet-ID behaviour. These are separate compatibility decisions, not interchangeable names for a seed.

First, two wallets must agree on how they interpret the mnemonic. Matching words alone are not enough to establish matching keys. Even when the Ed25519 public key is identical, the wallet contract version and `wallet_id` or subwallet configuration can select different TON accounts. The address identifies a configured wallet contract account, not merely a public key. **Authority: TON TEP-3.**

Use this as the practical compatibility model:

```text
mnemonic interpreted using the wallet’s mnemonic scheme
    ↓
Ed25519 key
    ↓
wallet implementation
    ↓
wallet contract version
    ↓
wallet_id / subwallet configuration
    ↓
workchain / network presentation
    ↓
TON address
```

This is a checklist of inputs and choices, not a ladder of public child-key derivations. Match the workchain and intended network presentation as well as the key and contract configuration.

There is also a standards boundary here. [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) defines its extended-key and public-child derivation machinery using secp256k1. That machinery is not a drop-in interface for TON’s Ed25519 wallet keys. Do not relabel a TON public key as a “TON xpub” to make the account model resemble Bitcoin.

This explains why importing what appears to be “the same seed” can produce a different TON address: either the mnemonic interpretation differs, or the same key is being used with a different wallet configuration. **Authority: TON TEP-3.**

**You should see:** a TON compatibility check that includes the mnemonic/key scheme, contract version, `wallet_id` or subwallet configuration, workchain and network—not a mnemonic-only address expectation.

## 3. Read the Bawa record literally

Bawa’s `generate.js` uses these checks and Wallet Core calls:

```javascript
ok("coin_ton_607", CoinType.ton.value === 607);
const tonAddress = w.getAddressForCoin(CoinType.ton);
ok("ton_valid", CoinTypeExt.validate(CoinType.ton, tonAddress));
```

**Authority: Bawa `generate.js`.** The first check confirms that the binding identifies TON as coin type 607. The second confirms that Wallet Core accepts the returned address for `CoinType.ton`. It does not compare that address with the account selected by a separate receiving wallet.

The TON portion of the generated record is precise:

| Field | Value written by Bawa |
|---|---|
| `ton_address` | `tonAddress`, obtained from `w.getAddressForCoin(CoinType.ton)` |
| `ton_path` | The result of `CoinTypeExt.derivationPath(CoinType.ton)` |
| `ton_note` | `"single address per wallet; no xpub exported"` |

**Authority: Bawa `generate.js`.**

Use the recorded `ton_path`; do not replace it with a path assumed from another wallet. Treat it as derivation metadata, not as a declaration of the TON wallet contract version or `wallet_id`. Likewise, `ton_note` describes Bawa’s single-address export, not a limit on the accounts that TON wallet configurations can produce. **Authorities: Bawa `generate.js` and TON TEP-3.**

Bawa’s `make_wallet.py` maps `ton_address` to `TON_DEPOSIT_ADDRESS` in `.env`. There is no TON xpub mapping. A placeholder-only example is:

```dotenv
TON_DEPOSIT_ADDRESS=<VERIFIED_TON_ADDRESS>
```

The populated value must be the generated `ton_address`, verified in the intended receiving wallet before publication. Do not treat a passing `ton_valid` check as that cross-wallet verification.

**You should see:** successful `coin_ton_607` and `ton_valid` checks, all three TON record fields, and `TON_DEPOSIT_ADDRESS` containing the same verified `ton_address`—with no TON xpub export.

## 4. Use TON tooling for watch-only work

For TON monitoring, work outside Bawa’s xpub derivation flow. Use the ecosystem tooling listed in the [official TON SDK documentation](https://docs.ton.org/applications/sdks):

- **TypeScript:** [`@ton/core` and the TON core ecosystem](https://github.com/ton-org/ton) for low-level TON primitives; [`@ton/ton`](https://github.com/ton-org/ton) for higher-level, HTTP-oriented interaction.
- **Python:** `tonutils`, listed by the official SDK documentation.
- **Go:** `tonutils-go`, also listed there.

The SDK catalogue is the authority for these tooling recommendations; it does not change Bawa’s supported-chain lists.

Use the following verification procedure:

1. **Identify the intended wallet configuration.** Establish its exact contract version and `wallet_id`, including the relevant subwallet configuration, workchain and network. If reconstructing the account, obtain the corresponding public key and all required version-specific initialisation parameters. Do not assume another SDK’s defaults match the wallet. **Authority for the configuration requirements: TON TEP-3.**

2. **Use that configuration with the selected TON SDK.** An address-only monitor can query an already verified address. If your tooling reconstructs the address from a public key, select the correct contract implementation and supply the wallet’s exact parameters rather than substituting a generic wallet template. **Authorities: TON TEP-3 and the official TON SDK documentation.**

3. **Verify the address in that wallet before publishing it.** Compare the SDK result and Bawa’s `ton_address` with the intended wallet’s receiving account, using the SDK’s address handling and the correct network presentation. If they disagree, stop and resolve the key-scheme or contract-configuration difference. Do not publish the address merely because `ton_valid` passed.

4. **Monitor the verified account read-only.** Use the selected TON tooling for account-state and transaction queries on the intended network. Keep the mnemonic and private key out of the watcher. This is account monitoring, not a sequence of TON deposit addresses derived from an exported xpub. **Authorities: the official TON SDK documentation for tooling, and Bawa’s derivation-chain lists for the integration boundary.**

**You should see:** an address confirmed in the intended wallet using its exact contract version and `wallet_id`, followed by read-only monitoring of that account—without a TON xpub, a Bawa TON derivation command or secret material in the watcher.

# Solana

### Reference-only boundary

**Bawa code boundary:** Solana is reference-only here. Listing SOL does not mean Bawa implements it: these tools provide no Solana derivation, wallet generation or transaction signing.

[SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) assigns Solana coin type `501`. That identifies the coin-type component of a derivation path; it does not establish a complete wallet policy. [Wallet Core’s registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json) records Ed25519 for Solana.

Solana’s [account documentation](https://solana.com/docs/core/accounts) describes an account-based model: addressed accounts hold lamport balances and account data. For external integrations, reason about accounts and their state rather than importing Bitcoin’s unspent-output model.

**You should see:** SOL clearly classified as reference-only, without a Bawa derive, generate or sign workflow.

### Match the target wallet, not just the coin type

[BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) supplies the familiar purpose, coin, account, change and address-index hierarchy. It does not make every Solana wallet follow that complete layout.

[Wallet Core’s registry](https://github.com/trustwallet/wallet-core/blob/master/registry.json) documents both path forms below. Treat the wallet-style names as signposts, not guarantees covering every release or import mode.

```text
Trust/Sollet-style reference
    ↓
m/44'/501'/0'
```

```text
Phantom/Solflare-style reference
    ↓
m/44'/501'/0'/0'
```

[SLIP-10](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) specifies hardened-only child derivation for its Ed25519 construction; each apostrophe marks a hardened step. The additional `/0'` is another derivation step, not optional punctuation. These paths are therefore not interchangeable.

For interoperability, use the target wallet’s exact policy, including account numbering and import behaviour. Do not “normalise” a shorter path by adding generic BIP-44 change or address levels.

Verify the policy with published test material and known expected addresses for that wallet and path. Use external target-wallet tooling for this check: Bawa does not supply SOL derivation. Keep all illustrative secrets as placeholders, and never test recovery with a funded wallet’s mnemonic.

**You should see:** the expected test address reproduced using the exact target-wallet path, without silently adding or removing a hardened level.

### Choose the JavaScript runtime deliberately

The [Solana Foundation JavaScript SDK repository](https://github.com/solana-foundation/solana-web3.js) describes the `@solana/web3.js` 1.x line as maintenance-only and points new development towards [Solana Kit](https://github.com/anza-xyz/kit).

For new external JavaScript application work, choose Kit. Keep the Foundation SDK repository as the authority when maintaining legacy v1 integrations; do not assume a v1 example uses Kit’s interfaces.

This runtime recommendation does not change the **Bawa code boundary**: installing a Solana SDK does not provide a SOL implementation in these tools.

**You should see:** Kit selected for new application work, with any v1 dependency explicitly identified as legacy and separate from Bawa’s supported operations.

### RPC: observation is not finality

The [Solana RPC documentation](https://solana.com/docs/rpc) defines distinct commitment levels:

- `processed`: the responding node has processed the block, but the block may belong to a fork the cluster discards.
- `confirmed`: a supermajority has voted for the block; this is still distinct from finality.
- `finalized`: the cluster recognises the block as final after maximum vote lockout.

For an external tracker, choose commitment per operation and set it explicitly wherever the RPC method supports it. Keep provisional observations separate from finalised activity. If an operation requires finality, wait for `finalized` rather than treating the first observed transaction as final.

The same RPC documentation warns against relying on shared public endpoints for production workloads and notes possible HTTP `429` rate-limit responses. Plan production RPC capacity separately. Add bounded retries and back-off rather than repeatedly hammering a throttled endpoint.

**You should see:** an explicit commitment policy, provisional and finalised states kept distinct, and production RPC provision with deliberate `429` handling.

# Cardano

## Reference status is not implementation

We keep Cardano (ADA) here to show where a shared HD-wallet vocabulary stops being a shared implementation.

**Authority: Bawa code.** These tools provide **no ADA derivation, wallet or key generation, or transaction signing**. A reference entry must not be read as a supported-chain declaration.

Cardano also challenges the assumption that every HD wallet follows BIP-44: its Shelley-era hierarchy is specified by [CIP-1852](https://cips.cardano.org/cip/CIP-1852), with Cardano-specific key rules.

**You should see:** Cardano documented for comparison, without an ADA execution workflow in Bawa.

## Read the path and its roles correctly

**Authorities: CIP-1852 and [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).** CIP-1852 defines the Shelley-era path `m/1852'/1815'/account'/role/index`; SLIP-44 registers `1815` as Cardano’s coin type.

Read the hierarchy downwards:

```text
m
  ↓
1852'
  ↓
1815'
  ↓
account'
  ↓
role
  ↓
index
```

Under **CIP-1852**, the apostrophe marks hardened derivation. The purpose, coin type and account levels are hardened; role and index are not.

The relevant roles are:

- **`0` — external payment keys:** the receiving branch.
- **`1` — internal payment keys:** the change branch.
- **`2` — staking keys:** a separate branch for staking credentials.

These are sibling branches beneath an account, not consecutive steps through payment and then staking. An index selects a key within the chosen role. **Authority: CIP-1852.**

The coin-type number identifies the namespace; it does not specify the complete key-generation algorithm. Read SLIP-44 alongside Cardano’s derivation and generation standards, not instead of them.

**You should see:** purpose `1852'`, coin type `1815'`, a hardened account, and distinct payment and staking branches—not a Bawa-generated key.

## Match the cryptography and ledger, not just the number

**Authorities: CIP-1852 and [CIP-0003](https://cips.cardano.org/cip/CIP-0003).** Cardano’s HD derivation uses **BIP32-Ed25519**, while CIP-0003 specifies wallet key-generation schemes. Ed25519 is therefore not merely a curve label to swap into an existing Ethereum implementation: root-key generation and child derivation must both follow the intended Cardano scheme.

Changing an Ethereum BIP-32 implementation’s coin type to `1815` cannot supply those rules. Matching a printed path alone is not evidence of compatible keys.

Cardano also uses an **extended-UTXO (eUTXO)** ledger: transactions consume outputs and create new outputs. The HD `account'` component organises keys; it is not an Ethereum-style ledger account. **Authorities:** [Cardano’s eUTXO documentation](https://docs.cardano.org/learn/eutxo-explainer/) for the ledger model; CIP-1852 for the key hierarchy. Wallet Core’s [documented Cardano transaction schema](https://github.com/trustwallet/wallet-core/blob/master/src/proto/Cardano.proto) likewise describes UTXO-based transaction inputs and outputs—not a Bawa signing interface.

Use **Cardano-native tooling** that implements the required generation scheme, derivation and transaction handling. For multisignature HD wallets, consult [CIP-1854](https://cips.cardano.org/cip/CIP-1854), the authority for that separate layout; do not treat CIP-1852 as covering every Cardano wallet design.

**You should see:** a clearly identified Cardano-native route, with Bawa still outside ADA derivation, generation and signing.

## 02 Chains — choose by implemented behaviour

### Chain-selection decision table

Start with Bawa’s implementation boundary, not the coin-type number. Reference paths do not establish repo-wide defaults, wallet compatibility or signing support.

**Authorities:** **Bawa** means Bawa code; **WC** means Wallet Core docs. Coin types come from **SLIP-0044**. Other standards are named where they specify a hierarchy or format. Column authorities apply to every entry.

| Chain | Bawa scope — Bawa | Coin type — SLIP-0044 | Curve — WC | Model — WC | Derivation reference and authority | Address format and prefix — WC unless noted | Actual tool behaviour — Bawa |
|---|---|---:|---|---|---|---|---|
| BTC | Supported: watch-only | 0 | secp256k1 | UTXO | `m/84'/0'/0'/0/i` — BIP-84 | Native SegWit P2WPKH; Bech32 `bc1q…` on mainnet — BIP-84/BIP-173 | Watch-only derivation on exactly the shown route. |
| ETH / EVM | Supported: ETH watch-only | 60 | secp256k1 | Account | `m/44'/60'/0'/0/i` — BIP-44; WC | 20-byte hexadecimal address, displayed with `0x`. | Watch-only ETH derivation on exactly the shown route. |
| TRX | Supported: watch-only | 195 | secp256k1 | Account | `m/44'/195'/0'/0/i` — BIP-44; WC | Base58Check text beginning `T`; the underlying hexadecimal address begins `41`. | Watch-only derivation on exactly the shown route. |
| TON | Generation-only | 607 | Ed25519 | Smart-contract wallet account | Stored as `ton_path`, obtained through `CoinTypeExt.derivationPath(CoinType.ton)` — Bawa | Raw `<workchain>:<account-id-hex>`, or friendly Base64/Base64url. For workchain 0 without the test-only flag: `EQ…` bounceable, `UQ…` non-bounceable. | Generates one deposit address per wallet. No xpub exported; no watch-only child-address derivation. |
| SOL | Reference-only | 501 | Ed25519 | Account | Phantom/Solflare-style: `m/44'/501'/x'/0'`<br>Trust/Sollet-style: `m/44'/501'/x'` — WC wallet conventions; SLIP-0010 for the Ed25519 derivation scheme | Key-derived wallet address: Base58-encoded public key; no fixed textual prefix. | No derivation, generation or signing. |
| ADA | Reference-only | 1815 | Ed25519, using Cardano’s extended-key scheme | Extended-UTXO | Payment: `m/1852'/1815'/0'/0/0`<br>Staking: `m/1852'/1815'/0'/2/0` — CIP-1852; WC | Shelley Bech32: `addr1…` mainnet, `addr_test1…` testnet. Reward addresses: `stake1…` and `stake_test1…`, respectively — WC; CIP-19 | No derivation, generation or signing. |

The BTC, ETH and TRX entries are the derive tools’ **complete chain/path set**, not examples of a broader implementation. An ETH-shaped address does not establish support for another EVM network (**Bawa**).

Here, `i` is the non-hardened address index. In the SOL references, `x'` selects a hardened account index; the apostrophe marks hardening, not a particular curve (**BIP-32/BIP-44; SLIP-0010; WC**).

**You should see:** three implemented watch-only routes, one TON generation route, and no executable SOL or ADA route.

### Keep the scheme and address decisions separate

A path describes positions in a hierarchy. It does not independently choose the curve, public-key serialisation, address encoder, network or wallet implementation (**BIP-32/BIP-44; WC**). Make those selections explicitly:

```text
chain and network
  ↓
curve and HD scheme
  ↓
path and permitted key material
  ↓
address encoder and wallet parameters
  ↓
address
```

- **Public derivation has a boundary.** Under BIP-32, a suitable account extended public key can cover non-hardened descendants such as `/0/i`; it cannot cross a hardened step. SLIP-0010’s Ed25519 scheme provides no public-child derivation. Do not apply that restriction indiscriminately to every Ed25519-based design: Cardano uses a different extended-key construction (**BIP-32; SLIP-0010; WC; CIP-1852**).

- **Shared curves do not mean shared addresses.** BTC, ETH and TRX use secp256k1, but their address constructions and encodings differ. Reuse cryptographic building blocks only where the relevant standard permits the same construction; do not substitute one chain’s encoder for another’s (**WC; BIP-84/BIP-173**).

- **TON needs wallet parameters as well as key material.** Contract version and wallet ID affect the wallet account, so one mnemonic can correspond to multiple accounts. Bawa’s one-deposit-address limit remains a tool constraint, not a universal TON rule (**WC; Bawa**).

- **ADA’s roles are not interchangeable.** A Shelley base address incorporates payment and stake credentials. The `/2/0` reference identifies staking, not another payment branch (**WC; CIP-1852; CIP-19**).

Bawa’s tool behaviour is not a complete specification of derivation algorithms, public-key serialisation, encoders or ADA cryptography. Use the applicable BIP/SLIP, Wallet Core chain documentation and chain specification or reference implementation for those details; CIP-1852 supplies ADA’s hierarchy, not its entire cryptographic construction.

**You should see:** an explicit chain, scheme, network, encoder and wallet-parameter choice—not compatibility inferred from a matching path.

**Bawa code boundary:** watch-only derive tools implement only BTC `m/84'/0'/0'/0/i`, ETH `m/44'/60'/0'/0/i` and TRX `m/44'/195'/0'/0/i`. TON generates one deposit address per wallet, without an xpub watch-only flow. SOL and ADA are reference-only, not Bawa-supported.

**Standards authority — BIP32/44, SLIP10/44; Wallet Core chain docs:** a path alone does not establish curve, encoder, address format or wallet/cross-chain compatibility. Check each against the chain’s reference. Reuse cryptographic building blocks only where the applicable standards permit; otherwise follow the chain’s reference implementation.

### 1. Prefix mismatch

**Likely cause:** exporter and importer disagree about script type, network or extended-key serialisation (BIP32, BIP49, BIP84).

**Exact check:** for Bawa BTC, compare export metadata with purpose `84'`, coin `0'`, account `0'`, external branch `0`, index `i` and mainnet (Bawa code; BIP44/84; SLIP44). Decode the key version and depth: `xpub` does not prove purpose `44'` (BIP32). BIP84 specifies mainnet `zpub` and testnet `vpub`; its address prefixes are `bc1q` and `tb1q` respectively (BIP84/173).

**Fix:** check which serialisations Bawa’s parser accepts, then re-export the intended account accordingly. If its derivation scheme is unsupported, use a compatible wallet rather than changing the purpose or editing prefix text (Bawa code; BIP32/84).

```text
check export metadata
↓
check key serialisation
↓
check address encoder
```

**You should see:** agreement between the recorded account, accepted serialisation and expected network/script format.

### 2. Zero balance after restore

**Likely cause:** discovery is inspecting another path, account, branch, index range or network—not necessarily an empty wallet (BIP44; Wallet Core docs).

**Exact check:** compare the original purpose, SLIP44 coin type, account, change/index, network and extended-public-key/address serialisation. Reproduce `<previously-used-address>` before trusting the balance display (BIP32/44/84; Wallet Core docs). BIP44 discovery stops after 20 consecutive unused external addresses. Bawa’s listed derive paths cover only account `0'`, external branch `0`; they do not cover change branch `1` or other accounts (Bawa code; BIP44).

**Fix:** use a wallet supporting the original scheme and scan the relevant branches and index range. Do not replace the original derivation with a Bawa-supported path merely to obtain output (BIP44; Bawa code).

```text
reproduce <previously-used-address>
↓
inspect the matching network’s ledger
```

**You should see:** the recorded address reproduced; then check its history and balance. Matching an address does not promise a non-zero balance.

### 3. EVM address on the wrong network

**Likely cause:** a familiar address is being viewed on another ledger. EVM is a family, not one network (Wallet Core docs: Ethereum/EVM support).

**Exact check:** for Bawa ETH, verify purpose `44'`, coin `60'`, account `0'`, branch `0` and index `i` (Bawa code; BIP44; SLIP44). Check hexadecimal address serialisation and checksum conventions against the target network’s reference. Verify the wallet/RPC/explorer network and chain ID: the address alone does not select the ledger (Wallet Core docs).

**Fix:** select the intended network for inspection. Bawa documents no proposed-profile configuration syntax, encoder APIs, per-network settings—including EVM—or verified address outputs. Review Bawa code and the target network’s documentation/reference implementation before configuring a profile (Bawa code boundary).

```text
verify <target-chain-id>
↓
query its ledger for <address>
```

**You should see:** the intended chain ID and that ledger’s history and balance for the recorded address.

### 4. TRON text in an EVM address field

**Likely cause (Wallet Core docs):** shared secp256k1 was mistaken for a shared address format.

**Exact check (Bawa code; SLIP-0044; Wallet Core docs):** purpose `44'`, coin `195'`, account `0'`, then `/0/i`; ETH uses coin `60'`. TRON serialisation uses Base58Check over `0x41` plus 20 address bytes, not EVM hex. Check the network connection separately: TRON mainnet/testnet prefixes are shared.

**Fix (Bawa code):** derive for the intended supported chain rather than editing prefixes. Bawa’s watch-only derive tools implement only:
- BTC: `m/84'/0'/0'/0/i`
- ETH: `m/44'/60'/0'/0/i`
- TRX: `m/44'/195'/0'/0/i`

EVM is a family (Wallet Core docs); Bawa has no documented per-network EVM configuration (Bawa code). Consult the target network’s documentation/reference implementation and review Bawa code first.

**You should see:** the intended chain, path and address format agreeing.

### 5. TON treated as an xpub receive tree

**Likely cause (BIP-32; Wallet Core docs):** applying Bitcoin’s public-child derivation model to TON wallet-contract addresses.

**Exact check (Wallet Core docs; SLIP-0044):** Wallet Core’s reference path `m/44'/607'/0'` identifies purpose `44'`, coin `607'` and account `0'`; this is not a Bawa xpub profile. Check wallet-contract version, subwallet ID, workchain and network. Distinguish raw `workchain:hash` from friendly Base64/Base64url serialisation; verify checksum and bounceable/test-only flags.

**Fix (Bawa code; SLIP-0010):** use Bawa’s generation-only flow: one deposit address per wallet, with no xpub watch-only expansion. SLIP-0010 Ed25519 provides no public-child derivation.

**You should see:** one contract-specific deposit address, not an indexed receive-address stream.

### 6. Solana restored with the wrong wallet variant

**Scope (Bawa code):** SOL is reference-only, not Bawa-supported.

**Likely cause (Wallet Core docs):** selecting another wallet’s derivation variant.

**Exact check (Wallet Core docs; SLIP-0044; SLIP-0010):** verify purpose `44'`, coin `501'`, account `a'` and the complete path—for example, `m/44'/501'/a'` versus `m/44'/501'/a'/0'`. Preserve every hardened marker. Check the cluster separately: the Base58-encoded 32-byte Ed25519 public key does not encode its network.

**Fix (Wallet Core docs; SLIP-0010):** match the originating wallet’s derivation and account selection through its reference implementation. A path alone establishes neither curve, encoder, format nor wallet/cross-chain compatibility; reuse cryptography only where the relevant BIP/SLIP permits it.

**You should see:** the originating wallet’s expected public address for the selected account.

### 7. Cardano forced into a BIP-44 template

**Scope (Bawa code):** ADA is reference-only, not Bawa-supported.

**Likely cause (BIP-44; Wallet Core docs):** substituting Cardano’s coin type into a Bitcoin-style template.

**Exact check (Wallet Core docs; SLIP-0044):** for a Shelley/CIP-1852 target, check `m/1852'/1815'/a'/0/i`: purpose `1852'`, coin `1815'`, account `a'`, receive role `0`, index `i`. Confirm the address type, staking credential, network ID and Bech32 `addr`/`addr_test` serialisation. Byron restoration requires different rules.

**Fix (Wallet Core docs):** use the matching Cardano reference and its extended-Ed25519 derivation, not merely a purpose edit. Bawa provides no documented configuration syntax, encoder APIs, per-network settings or verified address outputs for proposed profiles (Bawa code).

**You should see:** the intended Cardano address type and network reproduced by the reference implementation.
