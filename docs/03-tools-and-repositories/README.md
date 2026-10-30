# Repository & Tool Map

This is the decision file: **what repository or service should be used for this exact job?**

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
| Broad multi-chain wallet crypto | `trustwallet/wallet-core` | Keys, derivation, addresses and signing primitives across many chains | Not an RPC/indexing layer | Open source; Bawa pins 4.8.4 in its reference runtime |
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

## Selection method

1. Start with the standard or official chain rule.
2. Find the canonical or mature implementation.
3. Check releases, tests, dependencies and maintenance.
4. Verify that the package solves the layer you actually need.
5. For money-moving software, verify critical behavior with an independent implementation or reference vector.

## Current infrastructure examples

This is a dated snapshot. Verify the live provider page before purchasing.

| Provider | Entry point | Typical reason to choose it |
|---|---:|---|
| Public explorer / RPC | $0 | Learning, manual verification, small personal tools |
| Alchemy | $0 free tier | EVM RPC and small applications |
| Infura | $0 Core tier | EVM RPC |
| Chainstack | $0 Developer tier | Multi-chain hosted RPC |
| Helius | $0 Free tier | Solana RPC/data |
| Ankr | PAYG | Variable usage and indexed APIs |
| GetBlock | Published paid tiers from about $49/mo | Multi-chain hosted RPC |
| QuickNode | Paid plans | RPC/Streams and larger workloads |
| Moralis | $149/mo Starter, annual billing | Higher-level wallet/token/NFT data |
| Self-hosted | Infrastructure cost | Privacy, control, custom indexing |

### Current published figures checked on October 5, 2026

- Alchemy: 30M Compute Units/month and 25 RPS on Free; PAYG starts at $0.525 per 1M CUs.
- Infura: 3M daily credits and 500 credits/second on Core; Developer is $50/month; Team is $225/month.
- Chainstack: 3M request units/month and 25 RPS on Developer; Growth $49/month; Pro $199/month; Business $499/month; Enterprise $990/month.
- Helius: 1M credits and 10 RPS on Free; Developer $49/month; Business $499/month; Professional $999/month.
- Ankr: current Advanced API documentation uses 1M API Credits = $0.10.
- Moralis: Starter $149/month billed annually; Pro $249/month; Business $749/month.

Prices, quotas and supported networks change.

## Independent verification: bip_utils

Use [bip_utils](https://github.com/ebellocchia/bip_utils) as an independent reference implementation for overlapping derivation schemes and public test vectors. It supports BIP-32, BIP-39, BIP-44, BIP-49, BIP-84, BIP-86, SLIP-0010 and CIP-1852 among many chain-specific systems.

It belongs in the test/reference layer, not beside Wallet Core as a second production wallet engine. See [Trust Wallet Core & Independent Verification](../11-trust-wallet-and-independent-verification/README.md).


## Trust Wallet Assets is a metadata repository, not a wallet

[trustwallet/assets](https://github.com/trustwallet/assets) is useful for token metadata, logos and token lists. It does not provide wallet derivation, key management, signing or transaction handling.

For a production application keep these boundaries explicit:

~~~
Wallet Core → keys / derivation / signing
Assets      → token metadata / logos / token lists
RPC/indexer → blockchain state / history
Application → allocation / orders / payment reconciliation
~~~
## 03 Tool map — ownership and limits

Use one owner per job; do not treat any tool as a complete wallet backend. **These boundaries are maintainer policy, not verified isolation.** Enforce them by reviewing the call sites.

```text
SCHEME AUTHORITY   BIP / SLIP texts
PRIMITIVES         Wallet Core
INDEPENDENT CHECK  bip_utils
```

```text
PROPOSED DATA OWNERS — maintainer policy
metadata             Trust Wallet Assets
network data         RPC / indexer
application records  Application DB
```

### Job → tool → boundary → exclusion

| Job | Tool | Required trust boundary | What it does NOT do |
|---|---|---|---|
| Keys, derivation, addresses, signing primitives | **Wallet Core** | Handles secret material; review the code before claiming isolation. | No node communication, balance retrieval or transaction broadcasting, as stated in Wallet Core’s official usage guide. |
| Independent scheme verification | **bip_utils** | Separate differential/reference test harness; published vectors or clearly marked placeholders only. | Not a second production engine. |
| Token and asset metadata, logos and token lists | **Trust Wallet Assets** | Metadata input, not signing authority; calls must receive no secret material. | Not a wallet or signing library, according to Trust Wallet Assets’ documentation. Not an authority on balances here. |
| Balances/history; submission through an RPC | **RPC / indexer** | Application service/data boundary; calls must receive no secret material. | No key custody or signing role here. Check the provider’s supported operations; do not assume an indexer supports broadcasting. |
| Application records | **Application DB** | Application storage boundary; calls must receive no secret material. | Not a signing engine or an authority on chain state in this design. |

**Evidence limit:** Bawa does not document an Assets metadata schema or API for using it, an RPC/indexer provider with supported operations and guarantees, or an application database model. Check the Assets documentation, choose a network provider and confirm its capabilities and guarantees, and define your application’s record model. RPC/indexer services and the application database are application infrastructure, not Bawa code. The table assigns responsibilities; it does not verify service capabilities.

### Authority stays with the scheme

Bawa names **BIPs 32, 39, 43, 44, 49, 84** and **SLIPs 0010, 0044, 0132** as the sources of truth for these schemes. The standards, not the implementations, define the rules.

The bip_utils documentation lists support for **BIPs 32, 39, 44, 49, 84, 86**, **SLIP-0010** and **CIP-1852**. Bawa uses bip_utils only for independent differential/reference testing. Agreement between libraries is a check, not a replacement for the standard. Bawa does not document verification coverage beyond this list; review the relevant standards and tests before relying on additional coverage.

### Invocation / code audit

`tools/hdwallet-gen/package.json` lists `@trustwallet/wallet-core` version `4.8.4`; `requirements.txt` lists `bip_utils` version `2.12.2`.

This section is a decision table, not a runnable recipe. Check each tool’s own documentation and the relevant Bawa call site before using it. These checks are review criteria, not reported execution results.

1. **Trace each proposed invocation to a table row**, including the data crossing its boundary.  
   **You should see:** an identified owner, call site and data category—or a clear record of what still needs tracing. Do not mark isolation as verified without code evidence.

2. **Review boundary enforcement at the call sites.**  
   **You should see:** evidence that metadata, network and application-record calls receive no secret material under this policy—or a recorded violation or unresolved review item. Do not assume the boundary is enforced.

3. **Review verification and signing examples.**  
   **You should see:** cited published vectors or clearly marked placeholders; bip_utils confined to independent checking; signing examples limited to testnet or conceptual use, never real funds. Only claim a successful comparison when both the vector and the observed result are recorded.
