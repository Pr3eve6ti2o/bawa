# Bawa — HD Wallets, Derivation, Recovery & Tracking: A Practical Guide

Bawa is just a name.

It is not a company, service, hosted wallet, custody provider, commercial product, or promise that one library can magically solve every blockchain problem.

This repository is meant to be a **one-time reference guide and working example** for people who want to understand the complete HD-wallet problem and build it correctly:

- how a secure random root becomes a mnemonic;
- how a mnemonic becomes deterministic keys;
- how different blockchain families turn those keys into addresses;
- which open-source repository is appropriate for each job;
- how to create a wallet on a trusted machine;
- how to keep a running application watch-only;
- how to allocate addresses safely;
- how to track balances and history starting at **$0**;
- when an RPC is enough and when you really need an indexer;
- when paying for an API is worthwhile;
- when running your own infrastructure makes sense;
- and how to verify that an implementation is doing what you think it is doing.

The goal is not to hide the difficult parts. The goal is to explain them well enough that you can make an informed choice instead of copying a random wallet snippet from the internet.

> **Important:** “perfect HD wallet” is not a technical standard. There is no universally perfect wallet implementation. The useful target is a wallet whose derivation rules, supported networks, security boundaries, recovery procedure, tests, dependencies, and operational assumptions are explicit, reproducible, and independently verifiable.

---

## Table of Contents

1. [Start here](#start-here)
2. [What this repository is for](#what-this-repository-is-for)
3. [The five layers you should not mix together](#the-five-layers-you-should-not-mix-together)
4. [HD wallets from first principles](#hd-wallets-from-first-principles)
5. [Mnemonic vs seed vs private key vs xpub](#mnemonic-vs-seed-vs-private-key-vs-xpub)
6. [BIP-32, hardened derivation and watch-only wallets](#bip-32-hardened-derivation-and-watch-only-wallets)
7. [BIP-44 paths, accounts, change and indexes](#bip-44-paths-accounts-change-and-indexes)
8. [Extended keys and version bytes](#extended-keys-and-version-bytes)
9. [Chain families: what changes and what does not](#chain-families-what-changes-and-what-does-not)
10. [Bitcoin](#bitcoin)
11. [EVM chains](#evm-chains)
12. [TRON](#tron)
13. [TON](#ton)
14. [Solana](#solana)
15. [Cosmos / IBC](#cosmos--ibc)
16. [Cardano](#cardano)
17. [Polkadot / Substrate](#polkadot--substrate)
18. [XRP Ledger](#xrp-ledger)
19. [Litecoin, Dogecoin and Bitcoin-like networks](#litecoin-dogecoin-and-bitcoin-like-networks)
20. [So which repository should I use?](#so-which-repository-should-i-use)
21. [Repository and tool map](#repository-and-tool-map)
22. [Bawa's implementation: exactly what it does](#bawas-implementation-exactly-what-it-does)
23. [Running Bawa from a clean machine](#running-bawa-from-a-clean-machine)
24. [Generating the wallet safely](#generating-the-wallet-safely)
25. [What gets written to disk](#what-gets-written-to-disk)
26. [Running the watch-only derivation tools](#running-the-watch-only-derivation-tools)
27. [Address allocation: the part Bawa cannot solve for you](#address-allocation-the-part-bawa-cannot-solve-for-you)
28. [Tracking a wallet for $0](#tracking-a-wallet-for-0)
29. [Free → low-cost → paid → self-hosted tracking](#free--low-cost--paid--self-hosted-tracking)
30. [RPC is not an indexer](#rpc-is-not-an-indexer)
31. [UTXO tracking vs account tracking](#utxo-tracking-vs-account-tracking)
32. [EVM token and NFT tracking](#evm-token-and-nft-tracking)
33. [Reorganizations, finality and confirmations](#reorganizations-finality-and-confirmations)
34. [Gap limits and discovering an HD wallet](#gap-limits-and-discovering-an-hd-wallet)
35. [Privacy: xpubs are not spending keys, but they are sensitive](#privacy-xpubs-are-not-spending-keys-but-they-are-sensitive)
36. [Backup and recovery](#backup-and-recovery)
37. [Signing: keep it separate from tracking](#signing-keep-it-separate-from-tracking)
38. [Hardware wallets](#hardware-wallets)
39. [Testing a wallet properly](#testing-a-wallet-properly)
40. [Dependency and supply-chain discipline](#dependency-and-supply-chain-discipline)
41. [Common mistakes](#common-mistakes)
42. [Troubleshooting](#troubleshooting)
43. [A sensible architecture for different sizes of project](#a-sensible-architecture-for-different-sizes-of-project)
44. [How to adapt this repository to another chain](#how-to-adapt-this-repository-to-another-chain)
45. [What this guide does not promise](#what-this-guide-does-not-promise)
46. [Professional checklist](#professional-checklist)
47. [Primary references](#primary-references)

---

# Start here

There are two very different questions people often call “building a wallet”:

### Question A — “How do I generate and derive keys?”

This is the **wallet/cryptography layer**.

You care about:

```text
secure entropy
    ↓
BIP-39 mnemonic
    ↓
seed
    ↓
HD derivation
    ↓
private/public keys
    ↓
addresses
```

### Question B — “How do I know what is happening on-chain?”

This is the **blockchain data layer**.

You care about:

```text
address / account / xpub
    ↓
RPC or indexed API
    ↓
blocks / transactions / logs / UTXOs
    ↓
balances / history / tokens / NFTs
    ↓
your database / UI / alerts
```

They are related, but they are not the same thing.

A library that creates a key does not automatically know a blockchain’s latest balance. A blockchain RPC that returns account state does not generate your mnemonic. An explorer that shows history does not mean you should give it your private key.

The whole purpose of this guide is to keep those boundaries obvious.

---

# What this repository is for

The practical reference implementation in this repository demonstrates one useful architecture:

```text
TRUSTED GENERATION MACHINE

mnemonic
   │
   ├── seed / private material stays here
   │
   └── derive account-level public roots
             │
             ├── BTC zpub
             ├── EVM xpub
             ├── TRX xpub
             └── chain-specific public/address material
                         │
                         ▼
WATCH-ONLY RUNTIME

public root / address
          │
          ▼
   address derivation
          │
          ▼
       tracking
          │
          ▼
       database
```

That boundary is the important part.

The runtime service should not need the mnemonic just to generate a fresh receiving address.

BIP-32 was designed in part around this kind of separation: a deterministic wallet can be split so that one system can have public access while another retains spending capability. See [BIP-32](https://bips.dev/32/).

---

# The five layers you should not mix together

A useful mental model is to treat a wallet stack as five separate layers.

| Layer | Question it answers | Typical tools |
|---|---|---|
| 1. Entropy & mnemonic | How is root secret material created? | BIP-39, `@scure/bip39`, Wallet Core |
| 2. Key derivation | How do we deterministically derive keys? | BIP-32, BIP-44, BIP-84, SLIP-0010, `@scure/bip32` |
| 3. Address & transaction crypto | How do keys become chain objects? | Wallet Core, bitcoinjs-lib, viem, chain SDKs |
| 4. Blockchain access | What does the network currently contain? | Bitcoin Core, JSON-RPC, chain nodes, hosted RPC |
| 5. Indexing & application data | How do we efficiently find history/tokens/NFTs? | Esplora/Electrum servers, indexed APIs, self-hosted indexers |

A “multi-chain wallet SDK” may cover layers 1–3 and almost none of 4–5.

That is normal.

---

# HD wallets from first principles

## 1. Entropy

Start with random data generated by a cryptographically secure random-number generator.

For a 24-word BIP-39 mnemonic, the usual choice is **256 bits of entropy**.

A good wallet should obtain that randomness from the operating system or a cryptographically secure library. Do not invent your own random generator. Do not use timestamps, usernames, mouse movements, “random” strings, or human-chosen words as wallet entropy.

Humans are extremely bad random-number generators.

## 2. BIP-39 mnemonic

BIP-39 turns entropy into a human-readable mnemonic and later turns the mnemonic into a binary seed. It is a human-facing encoding, not the HD tree itself.

For 256 bits of entropy:

```text
entropy                256 bits
checksum                 8 bits
                         ─────────
                         264 bits

264 / 11 = 24 words
```

BIP-39 then converts the normalized mnemonic into a 64-byte seed using PBKDF2-HMAC-SHA512 with 2048 iterations. See the [BIP-39 specification](https://bips.dev/39/).

That seed is still not “your Bitcoin private key”. It is root material from which a deterministic wallet scheme can derive one or more master trees.

## 3. HD derivation

BIP-32 defines the hierarchical deterministic tree for secp256k1 wallets.

Conceptually:

```text
seed
 │
 ▼
master node
 │
 ├── child 0
 ├── child 1
 ├── child 2
 └── ...
```

Every extended node contains both key-related and tree-related information such as depth, parent fingerprint, child number and chain code.

See [BIP-32](https://bips.dev/32/).

## 4. Purpose and coin/account structure

BIP-43 and BIP-44 add conventions on top of BIP-32 so software can agree on what different branches mean.

Classic BIP-44:

```text
m / purpose' / coin_type' / account' / change / address_index
```

Example:

```text
m/44'/60'/0'/0/0
```

means, by convention:


```text
44'  = BIP-44 purpose
60'  = Ethereum coin type
0'   = account 0
0    = external chain
0    = address 0
```

See [BIP-44](https://bips.dev/44/).

This is a convention, not a universal law of every blockchain.

---

# Mnemonic vs seed vs private key vs xpub

These terms are often mixed up. They should not be.

### Mnemonic

The human-readable recovery phrase.

Example shape only:

```text
word word word ... word
```

Never put a real mnemonic in documentation, tickets, source control or chat.

### BIP-39 passphrase

An optional additional input to BIP-39 seed derivation.

```text
seed = PBKDF2(mnemonic, "mnemonic" + passphrase)
```

The passphrase changes the resulting wallet completely. It is not a PIN and it is not a wallet-encryption password.

A wallet that uses an empty passphrase and a wallet that uses a non-empty passphrase can use the exact same 24 words and still have completely different keys.

### Private key

A secret signing key for one derived keypair/account. Possession normally gives spending authority for that account/key.

### Extended public key

An xpub/zpub/etc. is a serialized public HD node with chain code and derivation metadata.

An account-level xpub is useful for watch-only derivation because non-hardened descendants can be derived from it.

It cannot recreate the hardened private ancestors above it.

But “public” does not mean “harmless”: an xpub can expose the address graph below that node.

---

# BIP-32, hardened derivation and watch-only wallets

BIP-32 divides derivation into two important families.

```text
normal / non-hardened
0 .. 2^31-1

hardened
2^31 .. 2^32-1
```

The hardened boundary is crucial for watch-only design.

Suppose the wallet policy is:

```text
m/44'/60'/0'/0/i
```

The first three levels are hardened and the final levels are non-hardened.

The application can export the account public node corresponding to:

```text
m/44'/60'/0'
```

and later derive:

```text
/0/0
/0/1
/0/2
...
```

from the public side.

That is why account-level xpubs work so well for deposit-address generation.

The runtime should not be given an xprv “just because deriving the address was inconvenient”. That destroys the boundary you were trying to create.

---

# BIP-44 paths, accounts, change and indexes

A path is a policy.

It is not enough to tell someone:

> “This is an HD wallet.”

You need to tell them exactly which tree is being used.

The most important pieces are:

### Account

Separates logical wallets within one seed.

### Change / branch

In traditional BIP-44 this is:

```text
0 = external / receiving
1 = internal / change
```

Some account-based chains use a different compatibility convention. Ethereum tooling commonly uses a path where `0` is fixed as the change component and the final component is incremented as the address index.

### Address index

The final non-hardened child used for generating another address from the same account.

For a payment system, the index must be stored by the application.

Do not try to reconstruct the last-used index by looking at a few addresses and guessing.

---

# Extended keys and version bytes

A serialized extended key contains:

```text
version
 depth
 parent fingerprint
 child number
 chain code
 key data
 checksum
```

The first field is what changes common printable forms such as:

```text
xpub
ypub
zpub
xprv
yprv
zprv
```

For Bitcoin, SLIP-0132 registers version bytes such as:

| Serialization | Typical purpose |
|---|---|
| `xpub` | legacy BIP-44 account serialization |
| `ypub` | BIP-49 / nested SegWit |
| `zpub` | BIP-84 / native SegWit |

See the [SLIP-0132 registry](https://github.com/satoshilabs/slips/blob/master/slip-0132.md).

Do not treat `xpub` and `zpub` as cosmetic aliases.

The serialization tells compatible software how to interpret the downstream address scheme.

---

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

# So which repository should I use?

This is the question Bawa should answer better than almost anything else.

The right repository is determined by the job.

### If your goal is to learn the standards

Start with the standards themselves:

- [BIP-32](https://bips.dev/32/)
- [BIP-39](https://bips.dev/39/)
- [BIP-43](https://bips.dev/43/)
- [BIP-44](https://bips.dev/44/)
- [BIP-49](https://bips.dev/49/)
- [BIP-84](https://bips.dev/84/)
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)

These are the source of truth for the scheme, not a random GitHub implementation.

### If you need a small JavaScript BIP implementation

Look at:

- [@scure/bip39](https://github.com/paulmillr/scure-bip39)
- [@scure/bip32](https://github.com/paulmillr/scure-bip32)

They are especially useful when you want a small, auditable library surface.

### If you need broad multi-chain key functionality

Look at:

- [Trust Wallet Core](https://github.com/trustwallet/wallet-core)

Trust Wallet Core is an open-source, cross-platform low-level wallet library and currently documents support for more than 130 blockchains.

Use it for key/crypto/address/transaction primitives.

Do **not** pretend it is your blockchain indexer.

### If you need Bitcoin-specific application code

Look at:

- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [Bitcoin Core](https://github.com/bitcoin/bitcoin)

Use Bitcoin Core when you want the actual Bitcoin node/wallet environment. Use bitcoinjs-lib when you want a library integrated into a JavaScript application.

### If you need an EVM application library

Look at:

- [viem](https://github.com/wevm/viem)
- [ethers](https://github.com/ethers-io/ethers.js)

Use the EVM library for RPC clients, ABI encoding, transaction handling and application logic.

Do not ask it to become your multi-chain UTXO engine.

### If you need Solana application access

Use:

- [Solana Kit](https://github.com/anza-xyz/kit)
- the official [Solana documentation](https://solana.com/docs)

### If you need TON

Use the TON-native SDK family documented at:

https://docs.ton.org/applications/sdks

### If you need Cosmos/IBC metadata

Use:

- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)
- [CosmJS](https://github.com/cosmos/cosmjs)

### If you need Cardano

Start with the Cardano CIPs and Cardano-native tooling, especially CIP-1852 and CIP-0003.

### If you need Polkadot/Substrate

Use the Substrate/polkadot.js ecosystem and respect its cryptographic and SS58 conventions.

### If you need a hardware signer

Look at the official:

- [Trezor firmware/software ecosystem](https://github.com/trezor/trezor-firmware)
- [Ledger developer ecosystem](https://developers.ledger.com/)

The signing device should be treated as a separate trust domain, not as just another library in your web server.

---

# Repository and tool map

The table below is intentionally practical. “Recommended” does not mean “the only valid choice”. It means “a sensible place to start for this specific job”.

| Job | Recommended project | What it is good at | When not to use it | Cost / notes |
|---|---|---|---|---|
| Read the wallet standards | BIPs / SLIPs | Normative derivation rules | Never replace standards with a blog post | Free |
| BIP-39 implementation | `paulmillr/scure-bip39` | Small focused BIP-39 implementation | Do not assume BIP-39 defines chain-specific paths | Open source |
| BIP-32 implementation | `paulmillr/scure-bip32` | Focused HD derivation | Not a blockchain SDK | Open source |
| Broad multi-chain wallet crypto | `trustwallet/wallet-core` | Keys, derivation, address/tx primitives across many chains | Not an RPC/indexing layer | Open source; NPM integration is documented as beta |
| Bitcoin app library | `bitcoinjs/bitcoinjs-lib` | Bitcoin transaction/address tooling | Not a universal wallet SDK | Open source |
| Bitcoin full node | `bitcoin/bitcoin` | Full chain validation + node/wallet | Heavy for a simple personal tracker | Open source; storage/bandwidth required |
| Bitcoin indexed API | `Blockstream/esplora` | Address/UTXO/tx history | Bitcoin/Liquid-centric | Open source; can self-host |
| Bitcoin indexed server | `spesmilo/electrumx` | Efficient history queries on top of a full node | Operationally heavier than a hosted API | Open source |
| EVM application layer | `wevm/viem` | RPC, ABI, accounts, clients | Not a general indexer for every chain | Open source |
| EVM application layer | `ethers-io/ethers.js` | Ethereum/EVM integration | Not your indexer or node | Open source |
| Solana application layer | `anza-xyz/kit` | Modern Solana JavaScript SDK | Do not follow old web3.js v1 tutorials blindly for new work | Open source |
| TON low-level SDK | `ton-org/ton` / TON core ecosystem | TON primitives and contracts | Do not invent Bitcoin-like abstractions for TON | Open source |
| Cosmos metadata | `cosmos/chain-registry` | Chain, asset and IBC metadata | Not a wallet signer | Open source |
| Cosmos JS | `cosmos/cosmjs` | Accounts, signing and chain interaction | Not a generic multi-chain key engine | Open source |
| Cardano standard | Cardano CIPs | Key derivation/address policy | Do not substitute BIP-44 assumptions | Free specs |
| Substrate accounts | `polkadot-js` | sr25519/ed25519/ecdsa + SS58 | Not a Bitcoin-style xpub system | Open source |
| XRP app access | `xrpl/xrpl.js` | XRPL client/wallet functionality | Not a universal blockchain SDK | Open source |
| Hardware signer | Trezor | Hardware-rooted signing workflow | Do not use as merely a software crypto library | Hardware + open source components |
| Hardware signer | Ledger | Secure signing and device UX | Device-app development has its own SDK/review model | Hardware + developer stack |
| Local EVM development | Foundry / Anvil | Local EVM chains and testing | Not mainnet infrastructure | Open source |
| Public blockchain data | Official explorer / RPC | Quick manual verification | Privacy and rate-limit sensitive | Usually free for modest manual use |

### One sentence decision rule

**Use a standards document to decide the rule, a mature crypto library to implement the rule, a chain-native SDK to handle chain semantics, an RPC/node to read current state, and an indexer/database when you need searchable history.**

---

# Bawa's implementation: exactly what it does

The current Bawa reference implementation is deliberately narrower than the entire guidebook.

## `tools/hdwallet-gen/generate.js`

One-time wallet generation.

It:

1. opens the controlling terminal first;
2. initializes Trust Wallet Core;
3. runs deterministic checks before generating a fresh wallet;
4. creates a 256-bit BIP-39 wallet with an empty passphrase;
5. exports BTC/ETH/TRON public roots plus the configured TON address;
6. performs public derivation/address round trips;
7. encrypts the mnemonic with AES-256-GCM;
8. shows the mnemonic and separate data key only on the terminal;9. waits for operator confirmations;
10. writes the encrypted recovery artifact with restrictive permissions.

## `tools/make_wallet.py`

Orchestration layer.

It handles the surrounding filesystem/environment work and protects the public-output boundary.

## `tools/hdwallet-gen/derive.js`

One-shot watch-only derivation.

Input:

```text
xpub over stdin
chain + index as arguments
```

Output:

```text
one derived address
```

The xpub is deliberately not supplied in argv.

## `tools/hdwallet-gen/derive_daemon.js`

Persistent watch-only derivation service using newline-delimited JSON.

It loads Wallet Core once and reuses it rather than spawning a fresh Node/WASM process for every address.

## `tools/hdwallet-gen/compare.js`

Diagnostic tool for comparing the derived addresses against the parent application's expectations.

## `tools/decrypt_seed.py`

Recovery utility for the application-specific encrypted seed artifact.

## `test/smoke.test.js`

Repository-level invariant checks. These are deliberately not presented as proof of cryptographic correctness. Full vector and cross-implementation testing is still part of professional release work.

---

# Running Bawa from a clean machine

The README needs to be runnable, not merely descriptive.

## Prerequisites

For the current reference tree:

- a Unix-like environment is recommended for the interactive `/dev/tty` generation flow;
- Node.js matching the repository's `package.json` engine requirement;
- npm;
- Python 3.11+;
- a Python virtual environment for local tooling;
- enough disk space for dependencies and recovery backups;
- an **offline or trusted machine** for actual wallet generation.

Do not generate a real wallet on a random online shell or CI runner just because the code runs there.

## Clone

```bash
git clone https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

For a real installation, verify the commit/tag you intend to use before installing dependencies.

## Node dependencies

From the repository root:

```bash
npm install
```

If the root package is only an orchestration shell, install the wallet-core tooling as directed by its package boundary:

```bash
cd tools/hdwallet-gen
npm install
cd ../..
```

### Lockfiles matter

Before calling the repository production-ready, commit the lockfile generated from a clean install.

That turns:

```text
"install whatever satisfies this range"
```

into:

```text
"install the exact dependency graph that was tested"
```

The reference rewrite intentionally calls out a missing production lockfile as a release blocker rather than pretending it is already solved.

## Python environment

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

On Windows PowerShell the activation command is:

```powershell
.\.venv\Scripts\Activate.ps1
```

---

# Generating the wallet safely

Run generation only on a trusted machine.

```bash
python3 tools/make_wallet.py
```

The generator is intentionally interactive.

The process should refuse to continue when there is no controlling terminal.

That is not a convenience bug. It is part of the security boundary.

The high-level flow is:

```text
terminal check
     ↓
wallet-core self-checks
     ↓
256-bit wallet creation
     ↓
mnemonic validation
     ↓
public-root export
     ↓
public address cross-check
     ↓
AES-GCM encryption in-process
     ↓
operator confirms backup
     ↓
atomic encrypted-file write
     ↓
public material saved for runtime
```

### What you must record

The recovery information is:

1. the mnemonic;
2. the BIP-39 passphrase policy, if one is used;
3. the exact derivation path/policy for each chain;
4. any chain-specific wallet configuration needed for recovery;
5. the encrypted artifact and its separately stored key, if you are using that recovery method.

An xpub is **not** a wallet backup.

It is a watch-only capability.

---

# What gets written to disk

The reference implementation uses a small application-specific encrypted artifact, conceptually:

```json
{
  "alg": "AES-256-GCM",
  "kdf": "none - random 256-bit data key",
  "nonce_b64": "...",
  "ciphertext_b64": "..."
}
```

The actual plaintext mnemonic is not intended to be written to disk.

The random data-encryption key is deliberately stored separately.

### Important limitation

This is **application-specific encryption at rest**, not a universal replacement for a proper wallet backup standard.

Recovery interoperability still depends on knowing:

```text
mnemonic
+ passphrase policy
+ derivation paths
+ chain-specific wallet configuration
```

For TON, that last part is especially important.

---

# Running the watch-only derivation tools

## One-shot mode

Suppose you already have a public extended key in an environment variable.

```bash
echo "$XPUB_ETH" | node tools/hdwallet-gen/derive.js eth 5
```

The important part is not the exact shell syntax; it is the architecture:

```text
xpub from stdin
     ↓
validate chain
     ↓
validate index
     ↓
reject private extended-key versions
     ↓
derive approved path
     ↓
return address
```

## Daemon mode

Start:

```bash
node tools/hdwallet-gen/derive_daemon.js
```

Wait for:

```json
{"ready":true}
```

Then send lines such as:

```json
{"chain":"eth","xpub":"<ETH_XPUB>","index":5}
```

and expect:

```json
{"ok":true,"address":"<DERIVED_ADDRESS>"}
```

The exact public key and address values should come from your own wallet and never be copied from this README.

### Why stdin instead of argv?

Arguments can show up in process listings and diagnostic interfaces. Feeding the xpub over stdin is a cleaner boundary and costs almost nothing.

---

# Address allocation: the part Bawa cannot solve for you

This is an application problem, not an HD-derivation problem.

Bawa can calculate:

```text
account public root + branch + index
                    ↓
                 address
```

It cannot know:

```text
order #12345 → index 582
```

unless your application stores that mapping.

A proper payment database should at least retain:

```text
wallet/root identifier
chain
network
path template
branch
index
address
order/customer reference
status
created timestamp
first observed block
confirmation state
```

### Never do this under concurrency

```text
read max(index)
add 1
save
```

Two workers can race.

Instead use a database transaction/sequence/atomic counter and a uniqueness constraint such as:

```text
UNIQUE(wallet_root, chain, branch, index)
```

Then allocate and record the address in one transaction.

### Do not reuse indexes casually

If an address was shown to someone or associated with an order, keep the mapping permanently unless your wallet policy explicitly defines safe reuse.

The cost of another HD address is tiny. The cost of ambiguous payment history is not.

---

# Tracking a wallet for $0

You do not need a paid indexer to start learning.

A completely free personal tracker can be built from:

```text
Bawa-derived public addresses
         ↓
free RPC / public explorer API
         ↓
small local database
         ↓
cron / scheduled poll
         ↓
local dashboard
```

For a personal wallet, this can be enough.

## The cheapest possible setup

### Bitcoin

Use Blockstream's public Esplora API for simple queries:

```text
https://blockstream.info/api/
```

The API exposes address state, UTXOs, confirmed/mempool history and transaction details. See the [Esplora API documentation](https://github.com/Blockstream/esplora/blob/master/API.md).

Example shape:

```bash
curl https://blockstream.info/api/address/<BITCOIN_ADDRESS>
```

### EVM

Use JSON-RPC directly.

At the simplest level:

```text
eth_getBalance
eth_getTransactionCount
eth_getBlockByNumber
eth_getTransactionReceipt
eth_getLogs
```

You can call a public endpoint or a free hosted RPC provider.

The Ethereum JSON-RPC specification is documented at:

https://ethereum.org/developers/docs/apis/json-rpc/

### Solana

Solana publishes public cluster RPC endpoints such as:

```text
https://api.mainnet.solana.com
https://api.devnet.solana.com
https://api.testnet.solana.com
```

But Solana explicitly states that these shared endpoints are not intended for production applications and can enforce rate limits.

Use them for experiments and personal tools, not as a hidden guarantee of production capacity.

### TON

Use the TON-native SDK/HTTP ecosystem rather than trying to force TON through an Ethereum RPC abstraction.

### Cosmos

Use chain-specific RPC/LCD/gRPC endpoints and the Cosmos Chain Registry for the chain metadata.

---

# Free → low-cost → paid → self-hosted tracking

Prices and free quotas change. The examples below are a **snapshot for October 5, 2026**, not a promise of future pricing.

The right way to think about this ladder is:

```text
$0
 │
 ├── manual explorer checks
 │
 ├── public RPC / free APIs
 │
 ├── free hosted RPC tier
 │
 ├── inexpensive hosted RPC/indexing
 │
 ├── richer indexed APIs
 │
 └── self-hosted nodes + indexers

more control / privacy / reliability / complexity →
```

## Level 0 — $0 and almost no infrastructure

Use a block explorer manually.

Best for:

- one wallet;
- occasional checks;
- learning;
- verifying a transaction hash;
- checking whether a receiving address has ever been funded.

Worst for:

- automated monitoring;
- privacy-sensitive workflows;
- high-volume applications.

## Level 1 — $0 personal automation

Use:

- public RPCs;
- explorer APIs that permit the intended use;
- local SQLite/PostgreSQL;
- a tiny polling script.

This is the best place to start if your goal is educational.

You learn what an indexer is actually doing instead of hiding all the complexity behind a premium API.

## Level 2 — $0 hosted RPC

Current examples include:

### Alchemy

Alchemy currently advertises a free tier with:

- 30 million Compute Units/month;
- 25 requests/second;
- access to its developer platform and supported networks.

See current [Alchemy pricing](https://www.alchemy.com/pricing) and [free-tier details](https://support.alchemy.com/articles/5827006872-what-is-included-in-the-free-tier).

Use this for:

- development;
- low-traffic personal tools;
- early prototypes.

Do not interpret “free” as “no operational dependency”.

You are still trusting a third party with your RPC traffic and depending on its quotas and availability.

### Infura

Infura currently advertises a free Core tier with:

- 3 million daily credits;
- a 500-credit/second rate limit;
- access to supported networks and archive-data capabilities in the current plan description.

See [Infura pricing](https://www.infura.io/pricing) and [pricing documentation](https://docs.infura.io/get-started/pricing/).

### GetBlock

GetBlock currently lists a free shared-node tier and paid shared-node tiers. Its documentation describes the free tier as suitable for low-traffic use, while paid plans add higher capacity and features such as archive access depending on the plan/network.

See [GetBlock plans](https://getblock.io/pricing-new/).

### Helius — Solana

For Solana specifically, Helius currently lists:

- Free: $0, 1M credits, 10 RPS;
- Developer: $49/month, 10M credits, 50 RPS;
- larger tiers for higher throughput/data products.

See [Helius pricing](https://www.helius.dev/pricing).

This is a good example of why chain-specific providers can be valuable: Solana's data model and indexing needs differ from EVM's.

## Level 3 — inexpensive pay-as-you-go or entry plans

### Ankr

Ankr currently documents usage-based RPC pricing. Its published pricing maps API Credits to request costs; for example, its current documentation lists different credit costs for EVM and Solana RPC calls and a pay-as-you-go exchange rate of `0.10 USD = 1M API Credits`.

See [Ankr service plans](https://www.ankr.com/docs/rpc-service/service-plans/) and [Advanced API pricing](https://www.ankr.com/docs/advanced-api/pricing/).

This model is useful when you want to stay cheap but stop treating a free quota as your architecture.

### Chainstack

Chainstack's current published plans include a free Developer tier and progressively more capable paid tiers; its current pricing page lists:

- Free: 3M request units/month;
- Growth: $49/month;
- Pro: $199/month;
- Business: $499/month;
- Enterprise: $990/month.

See [Chainstack pricing](https://chainstack.com/pricing/).

The useful lesson is not the exact dollar figure; it is the shape of the market: higher quotas, more nodes, higher RPS, support and operational guarantees cost progressively more.

## Level 4 — indexed wallet APIs

Once you need questions such as:

```text
“show every ERC-20 transfer for this address”
“show NFT holdings”
“calculate wallet net worth”
“find historical token movements across many chains”
```

you are moving beyond raw RPC.

Examples include:

### Moralis

Moralis currently offers higher-level wallet, token and NFT APIs, with the current Starter plan listed at $149/month when billed annually, followed by larger Pro and Business tiers.

See [Moralis pricing](https://moralis.com/pricing/).

Use an indexed API when development speed is more important than owning the indexing stack.

Do not use one merely because `eth_getLogs` looked intimidating. Learn the raw model first if the goal is understanding.

### Bitquery

Bitquery provides indexed blockchain data APIs and is useful when you need richer cross-chain data than a raw RPC node naturally exposes.

See [Bitquery pricing](https://bitquery.io/pricing/).

## Level 5 — larger hosted infrastructure

At this level you care about:

- predictable throughput;
- multiple regional endpoints;
- higher RPS;
- WebSockets/streaming;
- archive/trace/debug access;
- support;
- SLAs or enterprise contracts;
- less operational work on your side.

Examples include the higher plans of Alchemy, Infura, Chainstack, GetBlock and specialized indexed-data vendors.

The right provider depends on the chain and the exact query workload.

## Level 6 — self-hosted nodes and indexers

This is not automatically cheaper.

It is mainly about **control**.

A self-hosted architecture could look like:

```text
                   INTERNET
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Bitcoin Core    EVM client      Solana / other node
        │              │              │
        ▼              ▼              ▼
     indexer        indexer        chain-specific indexer
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  your database
                       │
                       ▼
                  your tracker
```

For Bitcoin, Esplora and ElectrumX are examples of open-source indexing approaches.

For Ethereum, node clients such as Erigon can be run in different storage/pruning modes, and archive requirements can become substantial.

Self-host when you have a reason:

- privacy;
- independence from a third party;
- large query volume;
- predictable data retention;
- custom indexing requirements.

Do not self-host merely because someone on Twitter said “RPC providers are centralized”. Running a reliable node is an operational job.

---

# RPC is not an indexer

This distinction saves enormous amounts of confusion.

A normal RPC interface answers questions about blockchain state and execution.

For EVM:

```text
eth_blockNumber
eth_getBalance
eth_getCode
eth_call
eth_getLogs
eth_getTransactionByHash
eth_getTransactionReceipt
```

A high-level indexer may instead answer:

```text
wallet history
all token transfers
NFT ownership
token metadata
historical prices
wallet net worth
contract interactions
swaps
```

The indexer is doing substantial work behind the scenes:

```text
node data
   ↓
block ingestion
   ↓
transaction decoding
   ↓
event/log normalization
   ↓
contract/token metadata
   ↓
reorg handling
   ↓
database/index
   ↓
API query
```

That is why indexer APIs cost more than a bare node endpoint.

---

# UTXO tracking vs account tracking

## Bitcoin-like UTXO model

A tracker needs to answer:

```text
Which outputs belong to the wallet?
Which are unspent?
Which are spent?
Which transaction created each output?
Which transaction spent it?
```

Your state is naturally UTXO-oriented.

## EVM account model

A tracker needs to answer:

```text
native balance
nonce
contract storage / calls where relevant
transaction history
logs/events
token balances
token transfers
NFT ownership
```

An address's native balance is easy to query.

“Everything that happened to this wallet” is not.

## Solana

Solana adds another layer of complexity because accounts and program-owned/token accounts matter.

A portfolio tracker may need:

```text
SOL balance
SPL token accounts
token mint metadata
program interactions
transactions / instructions
NFT state
```

## TON

TON's account model and wallet contracts mean you should reason in terms of messages, contract state and token contracts rather than pretending every incoming transfer is an EVM-style transaction receipt.

## Cosmos

Cosmos ecosystems add modules and IBC packet/channel relationships to the tracking problem.

The practical rule is simple:

> **Store the raw chain-native facts first. Normalize into your own common schema second.**

---

# EVM token and NFT tracking

Tracking an EVM wallet's native balance is only the beginning.

For ERC-20 you care about transfer events and token decimals/metadata.

For ERC-721 you care about ownership of token IDs and transfer history.

For ERC-1155 you care about token IDs plus balances, often represented by batched transfer events.

That means a good indexed tracker eventually has structures resembling:

```text
wallet
contract
asset type
chain
block
transaction
log index
token id / amount
decimals
metadata
```

### Do not trust symbols alone

These can all be called:

```text
USDC
USDT
WETH
```

but the contract address is what identifies a token on a specific chain.

Always store:

```text
chain_id
contract_address
token_id (when applicable)
```

and treat the human-readable symbol as metadata.

---

# Reorganizations, finality and confirmations

A tracker must distinguish:

```text
seen
included
confirmed
finalized / economically final
```

The exact meaning changes by blockchain.

Bitcoin wallets usually use block confirmations and chain-work assumptions.

Ethereum-style networks may expose head/finality concepts through the node/client.

Solana explicitly exposes commitment levels such as `processed`, `confirmed` and `finalized`.

A good payment tracker therefore does not mark an order “paid forever” the instant it sees one RPC result.

At minimum store:

```text
first_seen_at
block / slot
transaction hash / signature
confirmation state
last_checked_at
```

and have a recheck path.

### Why?

Because blockchain state can change around the tip.

Your database is not the blockchain.

It is a cached interpretation of the blockchain.

That mindset is important.

---

# Gap limits and discovering an HD wallet

Address derivation and wallet discovery are not identical.

Suppose an account has:

```text
0
1
2
3
4
5
```

and the user has only ever received money at address `5`.

A discovery process that stops after finding a few unused addresses may fail to discover it if it uses a small gap limit.

Bitcoin's traditional HD-wallet conventions discuss an address gap-limit concept for discovery, and wallet implementations often scan a window of unused addresses before declaring the account empty.

For a payment system, there is a simpler and safer approach:

**you already know the indexes you allocated.**

Store them.

Do not force the tracker to rediscover your own order database from the chain if the application already owns the allocation history.

---

# Privacy: xpubs are not spending keys, but they are sensitive

An xpub does not normally let an attacker spend from the wallet.

It may still allow them to derive many receiving/change addresses below that public node.

For a merchant or personal wallet this can reveal:

- account structure;
- address reuse patterns;
- payment history;
- balances;
- customer relationships when payments are observable.

Treat xpubs as **watch-only secrets** rather than as ordinary public configuration.

Do not paste them into:

- public issue trackers;
- analytics dashboards you do not trust;
- random “xpub checkers”;
- browser extensions you have not reviewed;
- chat messages that are not necessary.

For a multi-account application, consider whether each subsystem really needs the account-level xpub or whether a narrower public node is sufficient.

---

# Backup and recovery

A real backup is the ability to recreate the same wallet independently.

For a conventional BIP-39/BIP-32 wallet, that generally means preserving:

```text
mnemonic
+ BIP-39 passphrase policy
+ chain derivation policy
+ account selection
+ network
```

For special chains add whatever the chain requires.

TON is the clearest example: wallet contract/version and wallet-ID/subwallet configuration can matter.

### Test recovery before funding

A recovery drill should look like:

```text
fresh machine
   ↓
clean software
   ↓
recover mnemonic
   ↓
apply exact passphrase
   ↓
apply exact derivation policy
   ↓
derive expected address
   ↓
compare to previously recorded address
```

Do this before trusting the wallet with meaningful funds.

### Separate backups

For the application-specific encrypted Bawa artifact:

```text
seed.enc.json   → one location

data key       → another location

mnemonic       → offline recovery location
```

Do not store all three in the same place and then congratulate yourself for having “encrypted backups”.

---

# Signing: keep it separate from tracking

A very useful architecture is:

```text
TRACKER / WEB SERVER

xpub / address only
      │
      └── derives and watches addresses

SIGNER

private key / hardware wallet
      │
      └── signs transaction

NETWORK

broadcast signed transaction
```

The tracking service should not need the private key.

The web server should not become the place where the seed is loaded just because signing is inconvenient.

For high-value systems, move signing into an offline or hardware-backed trust domain.

---
# Hardware wallets

Hardware wallets make the security boundary physical rather than merely architectural.

### Trezor

Trezor's firmware repository documents per-coin derivation paths and shows an important concept: paths differ by curve and blockchain family, and public nodes are only possible where the derivation semantics support them.

See:

https://github.com/trezor/trezor-firmware/blob/main/docs/misc/coins-bip44-paths.md

### Ledger

Ledger's developer documentation separates device apps, signing flows and wallet integration. Its current documentation also emphasizes user review and clear transaction presentation on the signing device.

See:

https://developers.ledger.com/

For EVM hardware signing, the device is not “an RPC provider”. It is a secure signing surface.

That distinction should remain intact.

---

# Testing a wallet properly

A professional wallet test plan is much larger than “the code runs and generated an address”.

## 1. Standards vectors

Test:

- BIP-39 mnemonic generation;
- BIP-39 mnemonic-to-seed vectors;
- BIP-32 master/child vectors;
- hardened and non-hardened derivation;
- leading-zero edge cases;
- extended-key serialization;
- checksum failures;
- path parsing.

## 2. Chain vectors

For every chain you support:

```text
known mnemonic
    ↓
known path
    ↓
known public key / extended key
    ↓
known address
```

Store those expected outputs in tests.

## 3. Independent verification

The strongest practical test is:

```text
implementation A
        vs
implementation B
```

Do not only test:

```text
wallet-core → wallet-core
```

because the same wrong assumption can appear on both sides.

## 4. Negative testing

Try:

- private extended keys where only public keys are accepted;
- malformed checksums;
- invalid chain names;
- `__proto__` / inherited-property inputs;
- negative indexes;
- indexes ≥ 2^31;
- oversized JSON lines;
- invalid base58;
- invalid mnemonic checksum;
- wrong passphrase;
- wrong AES authentication tag;
- missing files;
- symlinked paths.

## 5. Integration testing

For a tracker test:

```text
address allocation
      ↓
known funding transaction
      ↓
indexer/RPC observation
      ↓
database record
      ↓
confirmation update
```

Then deliberately simulate a retry, duplicate event and temporary RPC outage.

A production tracker is a distributed-system problem as much as it is a blockchain problem.

---

# Dependency and supply-chain discipline

Wallet code is sensitive to dependency drift.

A professional repository should have:

```text
exactly documented runtime versions
committed lockfiles
verified release tags
CI tests
secret scanning
dependency review
release checksums / provenance where appropriate
```

### Do not do this

```json
"dependency": "^4.8.4"
```

and assume that means “the code I tested”.

A caret range means future compatible versions may be selected.

For security-sensitive primitives, pin the tested release in the actual application lockfile and review upgrades deliberately.

Trust Wallet Core itself recommends checking the current release/version rather than blindly using an old example. See the official [Wallet Core repository](https://github.com/trustwallet/wallet-core).

### Reproducibility

For serious release engineering:

```text
source tag
    ↓
lockfile
    ↓
clean build
    ↓
tests
    ↓
artifact hash
    ↓
release
```

That is far more useful than writing “secure” in the README.

---

# Common mistakes

## Mistake 1: “BIP-39 is the wallet.”

No. BIP-39 gives you a mnemonic and a seed derivation procedure. The downstream HD/key/address policy is another layer.

## Mistake 2: “Every chain uses m/44'.”

No.

Bitcoin BIP-84 is a concrete example of a different purpose.

Cardano uses its own CIP purpose.

TON has wallet-contract semantics.

Substrate uses a different URI/crypto model.

## Mistake 3: “The same EVM address means the same network.”

No.

The address may be the same while the chain ID, RPC, balances and token contracts are different.

## Mistake 4: “RPC gives transaction history.”

Sometimes you can build history with RPC calls, but a raw RPC node is not a pre-built wallet index.

## Mistake 5: “The xpub is public so it belongs in `.env.example` with everything else.”

It can be public in cryptographic terms while still being privacy-sensitive operational data.

## Mistake 6: “If `getBalance` works, the tracker works.”

No.

You still need token events, retries, reorg handling, historical queries, persistence and reconciliation.

## Mistake 7: “Encrypting the seed means memory is safe.”

No.

During generation, plaintext secret material exists in process memory before encryption.

JavaScript strings and WebAssembly allocations do not provide a perfect secure-memory primitive.

## Mistake 8: “Self-hosted means free.”

Software can be free while the infrastructure is not.

A full node may require substantial disk, bandwidth, CPU, RAM, backups and maintenance.

## Mistake 9: “A random GitHub fork is an official implementation.”

Never assume this.

Start from:

- the blockchain's official documentation;
- the project's canonical repository;
- standards;
- maintainers with a visible history.

---

# Troubleshooting

## `npm install` fails

Check:

```bash
node --version
npm --version
```

Then inspect the exact package/version selected by the lockfile.

Do not immediately delete every dependency and install arbitrary “latest” versions.

## Bawa refuses to run because there is no TTY

That is expected for the one-time generation process.

Run generation from an actual interactive terminal on the trusted generation machine.

Do not defeat the check by piping fake input into the process.

## A derived address does not match the expected address

Check, in this order:

```text
same mnemonic?
same BIP-39 passphrase?
same curve?
same coin type?
same purpose?
same account?
same branch?
same index?
same network/address encoding?
same wallet implementation/configuration?
```

For TON add wallet contract/version and wallet-ID/subwallet configuration.

For Cardano add the exact CIP and role model.

For Solana check the exact derivation convention used by the source wallet.

## EVM address matches but the balance is zero

You may simply be connected to a different EVM chain.

Check:

```text
chain ID
RPC endpoint
network name
native currency
explorer
```

The same address can legitimately exist on multiple EVM networks.

## Tracker misses an incoming payment

Check:

```text
wrong address index?
index allocation database?
gap window?
wrong branch?
indexer lag?
RPC error?
reorg?
token contract mismatch?
wrong network?
```

This is why an address allocation table is so important.

---

# A sensible architecture for different sizes of project

## Personal wallet — $0

```text
Bawa / wallet SDK
      ↓
public addresses
      ↓
explorer / free RPC
      ↓
manual checks
```

No server needed.

## Personal automated tracker — still $0

```text
public addresses
      ↓
cron script
      ↓
free RPC / Esplora
      ↓
SQLite
      ↓
local dashboard
```

Great for learning.

## Small application

```text
wallet generation machine
        │
        └── xpubs
              │
              ▼
        application backend
              │
       ┌──────┴──────┐
       ▼             ▼
      RPC          indexer API
       │             │
       └──────┬──────┘
              ▼
          PostgreSQL
              │
              ▼
           web UI
```

Use a free hosted RPC tier initially and upgrade when the metrics justify it.

## Serious application

```text
          ┌──────────────────┐
          │ trusted generator│
          │ / offline signer │
          └────────┬─────────┘
                   │ public roots
                   ▼
        ┌─────────────────────┐
        │ application servers │
        └──────────┬──────────┘
                   │
       ┌───────────┼────────────┐
       ▼           ▼            ▼
   RPC provider  indexer API  own node(s)
       │           │            │
       └───────────┼────────────┘
                   ▼
            reconciliation DB
                   │
          ┌────────┴────────┐
          ▼                 ▼
       monitoring         signer
                              │
                              ▼
                           network
```

The signer remains separate.

## Fully self-hosted

Add chain nodes and self-hosted indexers where the privacy/independence requirement justifies the operational burden.

---

# How to adapt this repository to another chain

The dangerous way is:

```text
copy Bitcoin code
replace "btc" with "newchain"
change coin type
hope
```

The professional way is to answer these questions first:

1. What curve is used?
2. What mnemonic/seed specification is used?
3. What derivation algorithm is used?
4. What path is the ecosystem standard?
5. Are derivation levels hardened or public-derivable?
6. Is an account-level public node meaningful?
7. What is the address encoding?
8. What network identifier changes the address?
9. What is the transaction model?
10. What data source exposes current balance?
11. What data source exposes history?
12. What finality/reorg rules apply?
13. What test vectors exist?
14. What official wallet must you interoperate with?
15. What repository is considered canonical by the chain ecosystem?

Then write a chain-specific test fixture.

Only after that should the chain enter your generic registry.

---

# What this guide does not promise

This guide does not promise:

- that Trust Wallet Core is correct for every possible chain use case;
- that one derivation path is compatible with every wallet application;
- that free public RPC is suitable for production;
- that an xpub is harmless to expose;
- that JavaScript can guarantee perfect memory zeroization;
- that a hardware wallet eliminates every operational risk;
- that a hosted indexer gives you complete historical truth forever;
- that TON can be flattened into a Bitcoin-like path table;
- that Solana, Cardano or Substrate are interchangeable with secp256k1 BIP-32 chains;
- that “open source” means audited;
- that “audited” means immune to implementation mistakes;
- that a wallet is recoverable without preserving its derivation policy.

Those limitations are not weaknesses of the guide. They are part of being honest about the engineering problem.

---

# Professional checklist

Before calling an HD-wallet implementation “done”, check all of these.

### Wallet generation

```text
[ ] cryptographically secure entropy source
[ ] mnemonic standard documented
[ ] passphrase policy documented
[ ] exact derivation paths documented
[ ] chain-specific exceptions documented
[ ] deterministic vectors tested
[ ] independent implementation comparison performed
```

### Runtime

```text
[ ] runtime receives public material only
[ ] no private key in argv/logging
[ ] path is allowlisted
[ ] index range validated
[ ] malformed input cannot terminate the service
[ ] secrets are not echoed in errors
```

### Tracking

```text
[ ] chain/network stored explicitly
[ ] raw chain facts stored before normalization
[ ] index allocation is transactional
[ ] UTXO chains handled as UTXOs
[ ] EVM token contracts stored by address
[ ] reorg/finality state stored
[ ] RPC retry/timeout policy exists
[ ] indexer lag monitored
```

### Recovery

```text
[ ] mnemonic backup exists
[ ] passphrase policy recorded
[ ] chain paths recorded
[ ] chain-specific configuration recorded
[ ] encrypted artifact tested
[ ] separate encryption key backup exists
[ ] recovery drill completed before funding
```

### Release engineering

```text
[ ] dependency lockfile committed
[ ] version ranges reviewed
[ ] CI passes on clean machines
[ ] secret scanning enabled
[ ] dependency scanning enabled
[ ] tagged release built reproducibly
[ ] release artifacts/checksums recorded
[ ] security policy published
```

---

# Primary references

## Standards

- [BIP-32 — Hierarchical Deterministic Wallets](https://bips.dev/32/)
- [BIP-39 — Mnemonic code for generating deterministic keys](https://bips.dev/39/)
- [BIP-43 — Purpose Field for Deterministic Wallets](https://bips.dev/43/)
- [BIP-44 — Multi-Account Hierarchy](https://bips.dev/44/)
- [BIP-49 — Derivation for P2WPKH-nested-in-P2SH](https://bips.dev/49/)
- [BIP-84 — Derivation for P2WPKH based accounts](https://bips.dev/84/)
- [SLIP-0010 — Universal private key derivation](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044 — Registered coin types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132 — Registered HD version bytes](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)

## Bitcoin

- [Bitcoin Core](https://github.com/bitcoin/bitcoin)
- [Bitcoin Core descriptors](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md)
- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [Blockstream Esplora](https://github.com/Blockstream/esplora)
- [Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md)
- [ElectrumX](https://github.com/spesmilo/electrumx)

## Multi-chain wallet crypto

- [Trust Wallet Core](https://github.com/trustwallet/wallet-core)
- [Trust Wallet Core developer documentation](https://github.com/trustwallet/developer/tree/master/wallet-core)
- [@scure/bip32](https://github.com/paulmillr/scure-bip32)
- [@scure/bip39](https://github.com/paulmillr/scure-bip39)

## EVM

- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)
- [EIP-55 — Mixed-case checksum address](https://eips.ethereum.org/EIPS/eip-55)
- [EIP-155 — Simple replay attack protection](https://eips.ethereum.org/EIPS/eip-155)
- [EIP-1559 — Fee market change](https://eips.ethereum.org/EIPS/eip-1559)
- [viem](https://github.com/wevm/viem)
- [ethers](https://github.com/ethers-io/ethers.js)

## Solana

- [Solana documentation](https://solana.com/docs)
- [Solana RPC](https://solana.com/docs/rpc)
- [Solana Kit](https://github.com/anza-xyz/kit)
- [Solana web3.js / transition repository](https://github.com/solana-foundation/solana-web3.js)

## TON

- [TON SDK documentation](https://docs.ton.org/applications/sdks)
- [TON TEP-3 wallet guidelines](https://github.com/ton-blockchain/TEPs/blob/master/text/0003-wallets.md)
- [TON core ecosystem](https://github.com/ton-org/ton)

## Cosmos

- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)
- [CosmJS](https://github.com/cosmos/cosmjs)

## Cardano

- [CIP-1852](https://cips.cardano.org/cip/CIP-1852)
- [CIP-0003](https://cips.cardano.org/cip/CIP-0003)
- [CIP-1854](https://cips.cardano.org/cip/CIP-1854)

## Polkadot / Substrate

- [polkadot.js keyring](https://polkadot.js.org/docs/api/start/keyring/)
- [Substrate URI](https://polkadot.js.org/docs/keyring/start/suri/)

## XRP Ledger

- [XRPL docs](https://xrpl.org/docs/)
- [xrpl.js](https://github.com/XRPLF/xrpl.js)

## Hardware signing

- [Trezor firmware](https://github.com/trezor/trezor-firmware)
- [Ledger Developer Portal](https://developers.ledger.com/)

## Infrastructure pricing examples (current snapshot; verify before purchase)

- [Alchemy pricing](https://www.alchemy.com/pricing)
- [Alchemy free tier](https://support.alchemy.com/articles/5827006872-what-is-included-in-the-free-tier)
- [Infura pricing](https://www.infura.io/pricing)
- [Chainstack pricing](https://chainstack.com/pricing/)
- [GetBlock pricing](https://getblock.io/pricing-new/)
- [Ankr service plans](https://www.ankr.com/docs/rpc-service/service-plans/)
- [Helius pricing](https://www.helius.dev/pricing)
- [Moralis pricing](https://moralis.com/pricing/)
- [Bitquery pricing](https://bitquery.io/pricing)

---

# Final thought

A good HD-wallet repository should leave the reader with fewer mysteries, not more.

By the time you finish, you should be able to look at a wallet and answer:

```text
Where did the entropy come from?
What does the mnemonic mean?
What seed did it create?
What derivation standard is being used?
What exact path is being used?
Which part is hardened?
What public node can be exported safely?
How is the address encoded?
Which chain-specific rules are involved?
Which repository implements those rules?
How do I generate it safely?
How do I recover it?
How do I derive a new address without the seed?
How do I allocate that address to an order?
How do I track it without paying anything?
When do I need an indexer?
When is paying for RPC actually worth it?
When does self-hosting make sense?
How do I know my data is correct after a reorg?
How do I prove a new implementation agrees with a known-good one?
```

That is the standard this repository should aim for.

Not “here is a wallet script.”

**Here is the whole problem, here is the correct mental model, here is the standard, here is the right repository for each part, here is how to run it, and here is how to verify that you did it right.**