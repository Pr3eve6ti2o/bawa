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
- [XRPL.js](https://github.com/XRPLF/xrpl.js)