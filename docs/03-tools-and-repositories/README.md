# Repository and tool map

## 1. What this document decides

Choose one owner per job. “Recommended” means a sensible place to start for this specific job, not the only valid choice.

Use this document to select repositories and tools, with their responsibilities and limits. Use `docs/12` for the registry, `docs/11` for Wallet Core and `docs/02` for chain guidance.

## 2. Choose by job

Learn the standards first: [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), [BIP-43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki), [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki), [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki) and SLIP-0010/0044/0132 are the source of truth for the scheme, not a random GitHub implementation.

- **Small JavaScript BIP implementation:** use `@scure/bip39` and `@scure/bip32` (`paulmillr/scure-bip39`, `paulmillr/scure-bip32`) for a small, auditable library surface.
- **Broad multi-chain key functionality:** use Trust Wallet Core, an open-source, cross-platform, low-level wallet library documenting support for more than 130 blockchains. It handles keys, derivation, addresses and signing primitives — not blockchain indexing.
- **Bitcoin-specific application code:** use bitcoinjs-lib for transaction and address tooling in a JavaScript app, plus Bitcoin Core for the actual node and wallet environment.
- **EVM application library:** use viem (`wevm/viem`) for RPC, ABI, accounts and clients, plus ethers (`ethers-io/ethers.js`) for Ethereum/EVM integration. Use the [ethers documentation](https://docs.ethers.org/v6/).
- **Solana application access:** use Solana Kit (`anza-xyz/kit`), the modern JavaScript SDK, plus the [official Solana documentation source](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/index.mdx). Do not follow old web3.js v1 tutorials blindly for new work.
- **TON:** use the [TON-native SDK family](https://docs.ton.org/applications/sdks).
- **Cosmos/IBC metadata:** use the Cosmos Chain Registry (`cosmos/chain-registry`) for chain, asset and IBC metadata, plus CosmJS (`cosmos/cosmjs`) for accounts, signing and chain interaction.
- **Cardano:** use the Cardano CIPs plus Cardano-native tooling, especially CIP-1852 and CIP-0003.
- **Polkadot/Substrate:** use the Substrate/polkadot.js ecosystem. Respect its cryptographic and SS58 conventions.
- **Hardware signer:** use the Trezor firmware/software ecosystem (`trezor/trezor-firmware`) plus the [Ledger developer ecosystem](https://developers.ledger.com). Treat the signing device as a separate trust domain, rather than as another library in a web server.
- **Local EVM development:** use Foundry/Anvil for local EVM chains and testing, not mainnet infrastructure.
- **Public blockchain data:** use the official explorer or RPC for quick manual verification. Account for privacy and rate limits.

## 3. Repository and tool map

| Job | Recommended project | What it is good at | When not to use it | Cost and notes |
| --- | --- | --- | --- | --- |
| Read the wallet standards | BIPs/SLIPs | Normative derivation rules | Never replace the standards with a blog post | Free |
| BIP-39 implementation | paulmillr/scure-bip39 | Small, focused BIP-39 | Do not assume BIP-39 defines chain-specific paths | Open source |
| BIP-32 implementation | paulmillr/scure-bip32 | Focused HD derivation | Not a blockchain SDK | Open source |
| Broad multi-chain wallet crypto | trustwallet/wallet-core | Keys, derivation, addresses, signing primitives across many chains | Not an RPC/indexing layer | Open source; Bawa pins 4.9.1 in its reference runtime |
| Bitcoin app library | bitcoinjs/bitcoinjs-lib | Bitcoin transaction/address tooling | Not a universal wallet SDK | Open source |
| Bitcoin full node | bitcoin/bitcoin | Full chain validation, node/wallet | Heavy for a simple personal tracker | Open source; storage/bandwidth required |
| Bitcoin indexed API | Blockstream/esplora | Address/UTXO/transaction history | Bitcoin/Liquid-centric | Open source; can self-host |
| Bitcoin indexed server | spesmilo/electrumx | Efficient history queries on top of a full node | Operationally heavier than a hosted API | Open source |
| EVM application layer | wevm/viem | RPC, ABI, accounts, clients | Not a general indexer for every chain | Open source |
| EVM application layer | ethers-io/ethers.js | Ethereum/EVM integration | Not your indexer or node | Open source |
| Solana application layer | anza-xyz/kit | Modern Solana JavaScript SDK | Do not follow old web3.js v1 tutorials blindly for new work | Open source |
| TON low-level SDK | ton-org/ton / TON core ecosystem | TON primitives and contracts | Do not invent Bitcoin-like abstractions for TON | Open source |
| Cosmos metadata | cosmos/chain-registry | Chain, asset, IBC metadata | Not a wallet signer | Open source |
| Cosmos JavaScript | cosmos/cosmjs | Accounts, signing, chain interaction | Not a generic multi-chain key engine | Open source |
| Cardano standard | Cardano CIPs | Key derivation/address policy | Do not substitute BIP-44 assumptions | Free specs |
| Substrate accounts | polkadot-js | sr25519/ed25519/ecdsa plus SS58 | Not a Bitcoin-style xpub system | Open source |
| XRP app access | XRPLF/xrpl.js | XRPL client/wallet functionality | Not a universal blockchain SDK | Open source |
| Hardware signer | Trezor | Hardware-rooted signing workflow | Do not use as merely a software crypto library | Hardware plus open-source components |
| Hardware signer | Ledger | Secure signing plus device UX | Device-app development has its own SDK/review model | Hardware plus developer stack |
| Local EVM development | Foundry/Anvil | Local EVM chains and testing | Not mainnet infrastructure | Open source |
| Public blockchain data | Official explorer/RPC | Quick manual verification | Privacy- and rate-limit-sensitive | Usually free for modest manual use |

## 4. One-sentence decision rule

“Use a standards document to decide the rule, a mature crypto library to implement the rule, a chain-native SDK to handle chain semantics, an RPC/node to read current state, and an indexer/database when you need searchable history.”

## 5. Selection method

1. Start with the standard or official chain rule.
2. Find the canonical or mature implementation.
3. Check releases, tests, dependencies and maintenance.
4. Verify the package solves the layer you actually need.
5. For money-moving software, verify critical behaviour with an independent implementation or reference vector.

**Version-record runbook**

For each audit pin, expand step 3 into these checks and keep a record. Work from the pinned release, not a different release or the default branch.

1. **Check releases.** Match the exact version you intend to pin to the release it came from. Record both the version and the release identifier.
2. **Check tests.** Find the tests and reference vectors covering the behaviour you need at that release. Run the relevant tests and record their names, commands and results. Note coverage gaps. If you cannot run a test, record that rather than treating it as passed.
3. **Check dependencies.** Inspect the release’s dependency declarations and any lockfiles. Record its dependencies and resolved versions; distinguish those from allowed version ranges.
4. **Check maintenance.** Read the release history, repository activity and handling of relevant issues. Record the maintenance state you observe and what you based it on.

Use a record with these fields:

```text
Project/package:
Version:
Release:
Tests covering this pin:
Test commands and results:
Coverage gaps:
Dependencies and resolved versions:
Maintenance state and basis:
```

Repeat the checks when you change the pin. Mark anything you cannot establish as unknown rather than inventing a value.
## 6. Current infrastructure examples

Snapshot: 5 October 2026. See §10 for the pricing rule.

| Provider | Entry point | Typical reason |
| --- | --- | --- |
| Public explorer/RPC | Public access | Learning, manual verification, small personal tools |
| Alchemy | Free tier | EVM RPC and small applications |
| Infura | Core tier | EVM RPC |
| Chainstack | Developer tier | Multi-chain hosted RPC |
| Helius | Free tier | Solana RPC/data |
| Ankr | PAYG | Variable usage and indexed APIs |
| GetBlock | Published paid tiers | Multi-chain hosted RPC |
| QuickNode | Paid plans | RPC/Streams and larger workloads |
| Moralis | - | Higher-level wallet/token/NFT data |
| Self-hosted | Infrastructure cost | Privacy, control, custom indexing |

## 7. Independent verification: bip_utils

Use bip_utils as your independent reference for overlapping derivation schemes and public test vectors. It supports BIP-32, BIP-39, BIP-44, BIP-49, BIP-84, BIP-86, SLIP-0010, and CIP-1852, among many chain-specific systems.

Keep it in the test/reference layer only — not as a second production wallet engine beside Wallet Core. See `docs/11-trust-wallet-and-independent-verification`.

## 8. Trust Wallet Assets is a metadata repository, not a wallet

Trust Wallet Assets (`trustwallet/assets`) holds token metadata, logos, and token lists. Do not use it for wallet derivation, key management, signing, or transaction handling.

Keep these responsibilities separate:

- **Wallet Core:** keys, derivation, and signing.
- **Assets:** token metadata, logos, and token lists.
- **RPC/indexer:** blockchain state and history.
- **Your application:** allocation, orders, and payment reconciliation.
## 9. Tool map: ownership and limits

One owner per job; do not treat any tool as a complete wallet backend. These boundaries are maintainer policy, not verified isolation. Enforce them by reviewing the call sites.

| Job | Tool | Boundary | Exclusion |
| --- | --- | --- | --- |
| Keys, derivation, addresses, signing primitives | Wallet Core | Handles secret material; review the code before claiming isolation | No node communication, balance retrieval, or transaction broadcasting |
| Independent scheme verification | bip_utils | Separate differential/reference test harness; published vectors or clearly marked placeholders only | Not a second production engine |
| Token/asset metadata, logos, token lists | Trust Wallet Assets | Metadata input, not signing authority; calls must receive no secret material | Not a wallet or signing library; not an authority on balances here |
| Balances/history; submission through an RPC | RPC/indexer | Application service/data boundary; calls must receive no secret material | No key custody or signing role here; check the provider's supported operations; do not assume an indexer supports broadcasting |
| Application records | Application DB | Application storage boundary; calls must receive no secret material | Not a signing engine or an authority on chain state in this design |

**Evidence limit:** Bawa documents no Assets metadata schema or API, no RPC/indexer provider with supported operations and guarantees, and no application database model. Check the Assets documentation, choose a network provider and confirm its capabilities and guarantees, and define your application's record model. RPC/indexer services and the application database are application infrastructure, not Bawa code. The table assigns responsibilities; it does not verify service capabilities.

Authority stays with the scheme: BIPs 32, 39, 43, 44, 49, 84 and SLIPs 0010, 0044, 0132 are the sources of truth. Agreement between libraries is a check, not a replacement for the standard. Bawa does not document verification coverage beyond the bip_utils list; review the relevant standards and tests before relying on additional coverage.

**Invocation and code audit:** `tools/hdwallet-gen/package.json` lists `@trustwallet/wallet-core` 4.9.1; `requirements.txt` lists `bip_utils` 2.12.2. This section is a decision table, not a runnable recipe. Check each tool's own documentation and the relevant Bawa call site before using it. Three review checks:

1. Trace each proposed invocation to a table row, including the data crossing its boundary — an identified owner, call site, and data category, or a clear record of what still needs tracing; do not mark isolation as verified without code evidence.
2. Review boundary enforcement at the call sites — evidence that metadata, network, and application-record calls receive no secret material under this policy, or a recorded violation or unresolved review item; do not assume the boundary is enforced.
3. Review verification and signing examples — cited published vectors or clearly marked placeholders; bip_utils confined to independent checking; signing examples limited to testnet or conceptual use, never real funds; only claim a successful comparison when both the vector and the observed result are recorded.

**Version pins:** the "Version pins" table lives in the README (§5 shared contracts); this document cross-references it. Core 4.9.1 (source: `tools/hdwallet-gen/package.json`) and bip-utils 2.12.2 (source: `requirements.txt`).

**Lockfile blocker:** the missing root lockfile is a numbered release blocker (README §18). It is a prerequisite for any "reproducible install" claim for the repository root. `tools/hdwallet-gen/package-lock.json` is committed at `e3b65fb832db287fdc8d54794980dd0b3456cc12` (Core 4.8.4 exact, verified 2026-11-08); `npm ci` runs inside `tools/hdwallet-gen` (verified exit 0, D22). Exact commands: run `npm install` from a clean tree, commit `package.json` and `package-lock.json` together, then use `npm ci` for every later install. `npm ci` requires an existing lockfile, exits with an error on mismatch, deletes `node_modules` first, and never writes to `package.json` or the lockfile. Until the root lockfile is committed, `npm ci` cannot run against the repo root.

## 10. Canonical pricing note

Prices appear in exactly ONE place in this guide set: the costs reference in `docs/08-security-recovery`, labelled as an indicative snapshot dated 30 October 2026, recheck-required, not current quotations, with the recheck warning kept verbatim. No price figure is copied anywhere else in the guide set. No pricing page is cited anywhere. Before relying on any figure, re-check it against the vendor's current published pricing and re-date the snapshot; never supply a revised price without a source check. Review trigger: any figure older than its stated snapshot date, or any vendor pricing change, triggers a re-check. `docs/06` and `docs/16` point here, not at figures.

## 11. Sources

- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP-43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki)
- [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [BIP-49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki)
- [BIP-84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md)
- [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [SLIP-0132](https://github.com/satoshilabs/slips/blob/master/slip-0132.md)
- [Trust Wallet Core repository](https://github.com/trustwallet/wallet-core)
- [Trust Wallet Assets repository](https://github.com/trustwallet/assets)
- [bip_utils repository](https://github.com/ebellocchia/bip_utils)
- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)
- [Solana docs source](https://github.com/solana-foundation/solana-com/blob/main/apps/docs/content/docs/en/index.mdx)
- [ethers docs](https://docs.ethers.org/v6/)
- [Ledger developer ecosystem](https://developers.ledger.com)
- [TON SDKs](https://docs.ton.org/applications/sdks)
